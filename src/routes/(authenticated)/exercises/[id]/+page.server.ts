import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { and, eq, isNull, sql } from 'drizzle-orm';
import z from 'zod';
import { buildPrompt, outputSchema, responseFormat } from '$lib/prompts/translation-feedback';
import { tokenize } from '$lib/correction/tokenize';
import { diffArrays } from 'diff';
import { retry } from '$lib/server/retry';
import { createFormResponders } from '$lib/forms/result.server';
import { ANSWER_ID, answerFailure, answerSuccess } from '$lib/forms/answer';
import { parseExercisePayload, toPublicExercisePayload } from '$lib/exercise/parse-exercise';
import { openai, parseLlmResponse, LLM_MODEL } from '$lib/server/llm';
import { paramsSchema } from './lib/params';

const answer = createFormResponders({
	id: ANSWER_ID,
	success: answerSuccess,
	failure: answerFailure
});

async function persistUnratedCheck({
	exerciseId,
	payload
}: Pick<typeof schema.exerciseCheck.$inferInsert, 'exerciseId' | 'payload'>) {
	const exerciseCheck = (
		await db
			.insert(schema.exerciseCheck)
			.values({ exerciseId, payload })
			.onConflictDoUpdate({
				target: schema.exerciseCheck.exerciseId,
				targetWhere: isNull(schema.exerciseCheck.ratedAt),
				set: { payload: sql`${schema.exerciseCheck.payload}` }
			})
			.returning({ id: schema.exerciseCheck.id })
	).at(0);

	if (!exerciseCheck) throw new Error('Failed to persist exercise check');

	return exerciseCheck;
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const paramsParse = paramsSchema.safeParse(params);
	if (!paramsParse.success) return redirect(302, '/exercises');
	const { id: exerciseId } = paramsParse.data;

	const exercise = (
		await db
			.select({
				id: schema.exercise.id,
				payload: schema.exercise.payload
			})
			.from(schema.exercise)
			.where(
				and(
					eq(schema.exercise.id, exerciseId),
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exercise.archivedAt)
				)
			)
	)
		.map(({ id, payload }) => ({
			id,
			...toPublicExercisePayload(parseExercisePayload(payload))
		}))
		.at(0);

	if (!exercise) return redirect(302, '/exercises');

	const exerciseCheck = (
		await db
			.select({ id: schema.exerciseCheck.id })
			.from(schema.exerciseCheck)
			.innerJoin(schema.exercise, eq(schema.exerciseCheck.exerciseId, schema.exercise.id))
			.where(
				and(
					eq(schema.exerciseCheck.exerciseId, exerciseId),
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exerciseCheck.ratedAt)
				)
			)
			.limit(1)
	).at(0);

	if (exerciseCheck) return redirect(302, `/exercises/${exerciseId}/rate`);

	return { exercise };
};

export const actions = {
	answer: async ({ request, locals, params }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(303, '/login');

		const paramsParse = paramsSchema.safeParse(params);
		if (!paramsParse.success) return redirect(303, '/exercises');
		const { id: exerciseId } = paramsParse.data;

		const formData = await request.formData();
		const formDataParse = z
			.object({ answer: z.string().trim().min(1) })
			.safeParse({ answer: formData.get('answer')?.toString().trim() });

		if (!formDataParse.success) {
			return answer.fail({ error: { code: 'invalid_input' }, status: 400 });
		}

		const exercise = (
			await db
				.select({
					id: schema.exercise.id,
					payload: schema.exercise.payload,
					targetLanguage: schema.exercise.targetLanguage,
					nativeLanguage: schema.user.nativeLanguage
				})
				.from(schema.exercise)
				.innerJoin(schema.user, eq(schema.exercise.userId, schema.user.id))
				.where(
					and(
						eq(schema.exercise.id, exerciseId),
						eq(schema.exercise.userId, signedInUser.id),
						isNull(schema.exercise.archivedAt)
					)
				)
				.limit(1)
		)
			.map(({ id, targetLanguage, nativeLanguage, payload }) => ({
				id,
				targetLanguage,
				nativeLanguage,
				...parseExercisePayload(payload)
			}))
			.at(0);

		if (!exercise) return redirect(303, '/exercises');

		const existingExerciseCheck = (
			await db
				.select({ id: schema.exerciseCheck.id })
				.from(schema.exerciseCheck)
				.innerJoin(schema.exercise, eq(schema.exerciseCheck.exerciseId, schema.exercise.id))
				.where(
					and(
						eq(schema.exerciseCheck.exerciseId, exercise.id),
						eq(schema.exercise.userId, signedInUser.id),
						isNull(schema.exerciseCheck.ratedAt)
					)
				)
				.limit(1)
		).at(0);

		if (existingExerciseCheck) return redirect(303, `/exercises/${exercise.id}/rate`);

		if (exercise.type === 'full_answer' && exercise.version === 1) {
			const differences = diffArrays(
				tokenize(formDataParse.data.answer, exercise.targetLanguage),
				tokenize(exercise.payload.back, exercise.targetLanguage)
			).map(({ added, removed, value }) => ({ added, removed, value: value.join('') }));

			if (differences.length === 1 && !differences.at(0)?.added && !differences.at(0)?.removed) {
				await persistUnratedCheck({
					exerciseId: exercise.id,
					payload: { answer: formDataParse.data.answer, tips: [] }
				});

				return redirect(303, `/exercises/${exercise.id}/rate`);
			}

			try {
				const llmResponse = await retry({
					fn: async () => {
						const chatCompletion = await openai.chat.completions.create({
							messages: buildPrompt({
								original: exercise.payload.extra,
								expected: exercise.payload.back,
								answer: formDataParse.data.answer,
								nativeLanguage: exercise.nativeLanguage,
								targetLanguage: exercise.targetLanguage
							}),
							model: LLM_MODEL,
							response_format: responseFormat,
							reasoning_effort: 'low',
							max_completion_tokens: 2048
						});

						return parseLlmResponse(chatCompletion.choices.at(0)?.message.content, outputSchema);
					}
				});

				await persistUnratedCheck({
					exerciseId: exercise.id,
					payload: { answer: formDataParse.data.answer, tips: llmResponse.tips }
				});
			} catch (error) {
				console.error(error);
				return answer.fail({ error: { code: 'unexpected' }, status: 500 });
			}
		} else {
			throw new Error('Undefined exercise type or version');
		}

		return redirect(303, `/exercises/${exercise.id}/rate`);
	}
} satisfies Actions;
