import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { and, eq, isNull } from 'drizzle-orm';
import z from 'zod';
import Groq from 'groq-sdk';
import { GROQ_API_KEY } from '$env/static/private';
import { buildPrompt, outputSchema } from '$lib/prompts/translation-feedback';
import { tokenize } from '$lib/correction/tokenize';
import { diffArrays } from 'diff';
import { ChatTurnError } from '$lib/server/chat-turn';
import { retry } from '$lib/server/retry';
import { createFormResponders } from '$lib/forms/result.server';
import { CHECK_ANSWER_ID, checkAnswerFailure, checkAnswerSuccess } from '$lib/forms/check-answer';

import { parseExercisePayload, toPublicExercisePayload } from '$lib/exercise/parse-exercise';

const checkAnswer = createFormResponders({
	id: CHECK_ANSWER_ID,
	success: checkAnswerSuccess,
	failure: checkAnswerFailure
});

async function parseLlmResponse<T extends z.ZodType>(content: any, schema: T) {
	try {
		const json = JSON.parse(content);
		const parsed = schema.parse(json);
		return parsed;
	} catch {
		console.error('invalid llm response:', content);
		throw new ChatTurnError('llm_invalid_response');
	}
}

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const exerciseId = Number(params.id);

	const exercise = (
		await db
			.select({
				id: schema.exercise.id,
				type: schema.exercise.type,
				version: schema.exercise.version,
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
		.map(({ id, ...rest }) => ({
			id,
			...toPublicExercisePayload(parseExercisePayload(rest))
		}))
		.at(0);

	if (!exercise) return redirect(302, '/exercise');

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

	if (exerciseCheck) return redirect(302, `/exercise/${exerciseId}/review`);

	return { exercise };
};

export const actions = {
	checkAnswer: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const formData = await request.formData();
		const formDataSchema = z.object({
			exerciseId: z.number(),
			answer: z.string().trim().min(1)
		});
		const formDataParse = formDataSchema.safeParse({
			exerciseId: parseInt(formData.get('exercise_id')?.toString() ?? '-1'),
			answer: formData.get('answer')?.toString().trim()
		});

		if (!formDataParse.success) {
			return checkAnswer.fail({ error: { code: 'invalid_input' }, status: 400 });
		}

		const exercise = (
			await db
				.select({
					id: schema.exercise.id,
					type: schema.exercise.type,
					version: schema.exercise.version,
					payload: schema.exercise.payload,
					targetLanguage: schema.exercise.targetLanguage,
					nativeLanguage: schema.userProfile.nativeLanguage
				})
				.from(schema.exercise)
				.innerJoin(schema.userProfile, eq(schema.exercise.userId, schema.userProfile.userId))
				.where(
					and(
						eq(schema.exercise.id, formDataParse.data.exerciseId),
						eq(schema.exercise.userId, signedInUser.id),
						isNull(schema.exercise.archivedAt)
					)
				)
				.limit(1)
		)
			.map(({ id, targetLanguage, nativeLanguage, ...rest }) => ({
				id,
				targetLanguage,
				nativeLanguage,
				...parseExercisePayload(rest)
			}))
			.at(0);

		if (!exercise) return redirect(302, '/exercise');

		const exerciseCheck = (
			await db
				.select({ id: schema.exerciseCheck.id })
				.from(schema.exerciseCheck)
				.innerJoin(schema.exercise, eq(schema.exerciseCheck.exerciseId, schema.exercise.id))
				.where(
					and(
						eq(schema.exerciseCheck.exerciseId, formDataParse.data.exerciseId),
						eq(schema.exercise.userId, signedInUser.id),
						isNull(schema.exerciseCheck.ratedAt)
					)
				)
				.limit(1)
		).at(0);

		if (exerciseCheck) return redirect(302, `/exercise/${formDataParse.data.exerciseId}/review`);

		if (exercise.type === 'full_answer' && exercise.version === 1) {
			const differences = diffArrays(
				tokenize(formDataParse.data.answer, exercise.targetLanguage),
				tokenize(exercise.payload.back, exercise.targetLanguage)
			).map(({ added, removed, value }) => ({ added, removed, value: value.join('') }));

			if (differences.length === 1 && !differences.at(0)?.added && !differences.at(0)?.removed) {
				const exerciseCheck = (
					await db
						.insert(schema.exerciseCheck)
						.values({
							exerciseId: formDataParse.data.exerciseId,
							payload: { answer: formDataParse.data.answer, tips: [] }
						})
						.returning({ id: schema.exerciseCheck.id })
				).at(0);

				if (!exerciseCheck) throw new Error('Failed to create exercise check');

				return redirect(303, `/exercise/${formDataParse.data.exerciseId}/review`);
			}

			const groqClient = new Groq({ apiKey: GROQ_API_KEY });

			try {
				const llmResponse = await retry({
					fn: async () => {
						const chatCompletion = await groqClient.chat.completions.create({
							messages: buildPrompt({
								original: exercise.payload.extra,
								expected: exercise.payload.back,
								answer: formDataParse.data.answer,
								nativeLanguage: exercise.nativeLanguage,
								targetLanguage: exercise.targetLanguage
							}),
							model: 'openai/gpt-oss-20b',
							response_format: {
								type: 'json_schema',
								json_schema: {
									name: 'translation_feedback',
									strict: false,
									schema: z.toJSONSchema(outputSchema)
								}
							},
							temperature: 0,
							max_completion_tokens: 4096,
							top_p: 1,
							stop: null
						});

						return parseLlmResponse(chatCompletion.choices.at(0)?.message.content, outputSchema);
					}
				});

				await db.insert(schema.exerciseCheck).values({
					exerciseId: exercise.id,
					payload: { answer: formDataParse.data.answer, tips: llmResponse.tips }
				});
			} catch (error) {
				if (error instanceof ChatTurnError) {
					return checkAnswer.fail({ error: { code: 'chat_turn_error' }, status: 400 });
				}
				return checkAnswer.fail({ error: { code: 'unexpected' }, status: 500 });
			}
		} else {
			return checkAnswer.fail({
				error: { code: 'invalid_exercise_type_or_version' },
				status: 400
			});
		}

		return redirect(303, `/exercise/${formDataParse.data.exerciseId}/review`);
	}
} satisfies Actions;
