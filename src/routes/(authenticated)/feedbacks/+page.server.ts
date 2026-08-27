import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as z from 'zod';
import * as schema from '$lib/server/db/schema';
import { and, desc, eq, isNull } from 'drizzle-orm';
import { feedbackPayloadSchema } from '$lib/feedback/feedback-payload';
import { parseExercisePayload } from '$lib/exercise/parse-exercise';
import { retry } from '$lib/server/retry';
import {
	buildPrompt as buildErrorPatternPrompt,
	outputSchema as errorPatternsOutputSchema
} from '$lib/prompts/error-patterns';
import { groq, parseLlmResponse } from '$lib/server/groq';
import { createFormResponders } from '$lib/forms/result.server';
import {
	GIVE_FEEDBACK_CHAT_ID,
	giveFeedbackFailure,
	giveFeedbackSuccess
} from '$lib/forms/give-feedback';

const giveFeedback = createFormResponders({
	id: GIVE_FEEDBACK_CHAT_ID,
	success: giveFeedbackSuccess,
	failure: giveFeedbackFailure
});

export const load: PageServerLoad = async ({ locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const feedbacks = (
		await db
			.select({
				id: schema.feedback.id,
				createdAt: schema.feedback.createdAt,
				payload: schema.feedback.payload
			})
			.from(schema.feedback)
			.where(and(eq(schema.feedback.userId, signedInUser.id)))
			.orderBy(desc(schema.feedback.createdAt))
	).map(({ payload, ...rest }) => {
		return { ...rest, payload: feedbackPayloadSchema.parse(payload) };
	});

	return { feedbacks };
};

export const actions = {
	giveFeedback: async ({ locals, request }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(303, '/login');

		const userProfile = (
			await db
				.select({ nativeLanguage: schema.userProfile.nativeLanguage })
				.from(schema.userProfile)
				.where(eq(schema.userProfile.userId, signedInUser.id))
				.limit(1)
		).at(0);

		if (!userProfile) return redirect(303, '/login');

		try {
			const mistakesByLanguage = (
				await db
					.select({
						payload: schema.exercise.payload,
						targetLanguage: schema.exercise.targetLanguage
					})
					.from(schema.exercise)
					.where(
						and(eq(schema.exercise.userId, signedInUser.id), isNull(schema.exercise.archivedAt))
					)
					.orderBy(desc(schema.exercise.createdAt))
			).reduce((mistakesByLanguage, exercise) => {
				const languageMistakes = mistakesByLanguage.get(exercise.targetLanguage) ?? [];
				const { type, version, payload } = parseExercisePayload(exercise.payload);

				if (type === 'full_answer') {
					if (version === 1) {
						languageMistakes.push({ wrote: payload.front, instead: payload.back, note: null });
						mistakesByLanguage.set(exercise.targetLanguage, languageMistakes);
					} else {
						throw new Error('Undefined exercise type or version');
					}
				} else {
					throw new Error('Undefined exercise type or version');
				}

				return mistakesByLanguage;
			}, new Map<typeof schema.exercise.$inferSelect.targetLanguage, { wrote: string; instead: string; note: string | null }[]>());

			if (mistakesByLanguage.size <= 0) {
				return giveFeedback.ok({ data: null });
			}

			const llmResponses = await Promise.all(
				Array.from(mistakesByLanguage).map(([targetLanguage, mistakes]) =>
					retry({
						fn: async () => {
							const chatCompletion = await groq.chat.completions.create({
								messages: buildErrorPatternPrompt({
									nativeLanguage: userProfile.nativeLanguage,
									targetLanguage,
									mistakes
								}),
								response_format: {
									type: 'json_schema',
									json_schema: {
										name: 'error_patterns',
										schema: z.toJSONSchema(errorPatternsOutputSchema, { io: 'input' }),
										strict: false
									}
								},
								model: 'openai/gpt-oss-20b',
								temperature: 0,
								max_completion_tokens: 4096,
								top_p: 1,
								stop: null
							});

							return {
								targetLanguage,
								...parseLlmResponse(
									chatCompletion.choices.at(0)?.message.content,
									errorPatternsOutputSchema
								)
							};
						}
					})
				)
			);

			await db.insert(schema.feedback).values(
				llmResponses.map(({ patterns }) => ({
					userId: signedInUser.id,
					payload: { version: 1 as const, payload: { patterns } }
				}))
			);
		} catch (error) {
			console.error(error);
			return giveFeedback.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return giveFeedback.ok({ data: null });
	}
} satisfies Actions;
