import { requireUserSession } from '$lib/server/session-user';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import * as fsrsSchema from '$lib/server/db/fsrs.schema';
import { db } from '$lib/server/db';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import {
	narrowExercisePayload,
	type SelectFnMap
} from '$lib/server/exercise/narrow-exercise-payload';
import z from 'zod';
import Groq from 'groq-sdk';
import { GROQ_API_KEY } from '$env/static/private';
import { prompts, translationFeedbackSchema } from '$lib/prompts/translation-feedback';
import { createEmptyCard, fsrs, Rating, type StepUnit } from 'ts-fsrs';
import { desc } from 'drizzle-orm';

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const selectFn = {
		full_answer: {
			1: ({ front }) => ({ front }),
			2: ({ front, extra }) => ({ front, extra })
		}
	} satisfies SelectFnMap;
	const exercises = (
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
					eq(schema.exercise.id, parseInt(params.id)),
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exercise.archivedAt)
				)
			)
	).map((row) => narrowExercisePayload(row, selectFn));
	if (exercises.length !== 1) return redirect(302, '/exercise');

	return { exercise: exercises[0] };
};

function parseTranslationFeedback(content: string) {
	try {
		return translationFeedbackSchema.parse(JSON.parse(content));
	} catch {
		return null;
	}
}

export const actions = {
	checkAnswer: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const formData = await request.formData();
		const zodSchema = z.object({
			exerciseId: z.number(),
			answer: z
				.string()
				.min(1)
				.transform((value) => value.trim())
		});
		const { success, data } = zodSchema.safeParse({
			exerciseId: parseInt(formData.get('exercise_id')?.toString() ?? '-1'),
			answer: formData.get('answer')?.toString().trim()
		});
		if (!success) return fail(400, { code: 'invalid_input' });

		const selectFn = {
			full_answer: {
				1: ({ front, back }) => ({ front, back }),
				2: ({ front, back, extra }) => ({ front, back, extra })
			}
		} satisfies SelectFnMap;
		const exercises = (
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
						eq(schema.exercise.id, data.exerciseId),
						eq(schema.exercise.userId, signedInUser.id),
						isNull(schema.exercise.archivedAt)
					)
				)
				.limit(1)
		).map(({ targetLanguage, nativeLanguage, ...rest }) => ({
			targetLanguage,
			nativeLanguage,
			...narrowExercisePayload(rest, selectFn)
		}));
		if (exercises.length !== 1) return redirect(302, '/exercise');

		if (exercises[0].type === 'full_answer' && exercises[0].version === 2) {
			const groqClient = new Groq({ apiKey: GROQ_API_KEY });
			const chatCompletion = await groqClient.chat.completions.create({
				messages: prompts(
					{
						original: exercises[0].payload.extra,
						expected: exercises[0].payload.back,
						answer: data.answer
					},
					{
						nativeLanguage: exercises[0].nativeLanguage,
						targetLanguage: exercises[0].targetLanguage
					}
				),
				model: 'openai/gpt-oss-20b',
				temperature: 0.5,
				max_completion_tokens: 4096,
				top_p: 1,
				stop: null
			});
			if (!chatCompletion.choices[0].message.content) {
				return fail(500, { code: 'invalid_llm_response' });
			}

			const translationFeedback = parseTranslationFeedback(
				chatCompletion.choices[0].message.content
			);
			if (!translationFeedback) {
				return fail(500, { code: 'invalid_llm_response' });
			}

			return {
				tips: translationFeedback.tips,
				expected: exercises[0].payload.back,
				answer: data.answer
			};
		} else {
			return fail(400, { code: 'invalid_exercise_type' });
		}
	},
	answerExercise: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const formData = await request.formData();
		const zodSchema = z.object({
			exerciseId: z.number(),
			rating: z.enum(['again', 'hard', 'good', 'easy'])
		});
		const ratingToFsrsRating = {
			again: Rating.Again,
			hard: Rating.Hard,
			good: Rating.Good,
			easy: Rating.Easy
		} as const;
		const { success, data } = zodSchema.safeParse({
			exerciseId: parseInt(formData.get('exercise_id')?.toString() ?? '-1'),
			rating: formData.get('rating')?.toString() ?? ''
		});
		if (!success) return fail(400, { code: 'invalid_input' });

		const userSrsProfiles = await db
			.select({ algorithm: schema.userSrsProfile.algorithm, setup: schema.userSrsProfile.setup })
			.from(schema.userSrsProfile)
			.where(and(eq(schema.userSrsProfile.userId, signedInUser.id)))
			.limit(1);
		if (userSrsProfiles.length !== 1) return redirect(302, '/exercise');

		const reviewDate = new Date();
		if (userSrsProfiles[0].algorithm === 'fsrs') {
			const fsrsParametersSchema = z
				.object({
					enable_short_term: z.literal(true),
					enable_fuzz: z.boolean(),
					learning_steps: z.array(
						z
							.string()
							.regex(/^\d+[mhd]$/)
							.transform((value) => value as StepUnit)
					),
					maximum_interval: z.number(),
					relearning_steps: z.array(
						z
							.string()
							.regex(/^\d+[mhd]$/)
							.transform((value) => value as StepUnit)
					),
					request_retention: z.number(),
					w: z.array(z.number())
				})
				.partial();
			const parsedFsrsParameters = fsrsParametersSchema.safeParse(userSrsProfiles[0].setup);
			if (!parsedFsrsParameters.success) return fail(400, { code: 'invalid_fsrs_parameters' });

			const fsrsCards = await db
				.select({
					id: fsrsSchema.fsrsCard.id,
					stateBlob: fsrsSchema.fsrsCard.stateBlob,
					nextDueAt: fsrsSchema.fsrsCard.nextDueAt
				})
				.from(fsrsSchema.fsrsCard)
				.where(
					and(
						eq(fsrsSchema.fsrsCard.userId, signedInUser.id),
						eq(fsrsSchema.fsrsCard.exerciseId, data.exerciseId)
					)
				)
				.limit(1);

			const scheduler = fsrs(parsedFsrsParameters.data);

			if (fsrsCards.length === 0) {
				const card = createEmptyCard(reviewDate);
				const recordLogItem = scheduler.next(card, reviewDate, ratingToFsrsRating[data.rating]);
				await db.transaction(async (tx) => {
					const fsrsCard = (
						await tx
							.insert(fsrsSchema.fsrsCard)
							.values({
								userId: signedInUser.id,
								exerciseId: data.exerciseId,
								stateBlob: recordLogItem.card,
								nextDueAt: recordLogItem.card.due
							})
							.returning({ id: fsrsSchema.fsrsCard.id })
					).at(0);

					// This should never happen.
					if (!fsrsCard) throw new Error('Failed to create FSRS card in database');

					await tx.insert(fsrsSchema.fsrsReviewLog).values({
						userId: signedInUser.id,
						fsrsCardId: fsrsCard.id,
						reviewedAt: reviewDate,
						rating: data.rating,
						stateBlob: recordLogItem.log
					});
				});
			} else {
				const recordLogItem = scheduler.next(
					fsrsCards[0].stateBlob,
					reviewDate,
					ratingToFsrsRating[data.rating]
				);

				await db.transaction(async (tx) => {
					await tx
						.update(fsrsSchema.fsrsCard)
						.set({ stateBlob: recordLogItem.card, nextDueAt: recordLogItem.card.due })
						.where(
							and(
								eq(fsrsSchema.fsrsCard.userId, signedInUser.id),
								eq(fsrsSchema.fsrsCard.exerciseId, data.exerciseId)
							)
						);
					await tx.insert(fsrsSchema.fsrsReviewLog).values({
						userId: signedInUser.id,
						fsrsCardId: fsrsCards[0].id,
						reviewedAt: reviewDate,
						rating: data.rating,
						stateBlob: recordLogItem.log
					});
				});
			}
		} else {
			return fail(400, { code: 'invalid_srs_algorithm' });
		}

		const pendingExercises = await db
			.select({
				id: schema.exercise.id
			})
			.from(fsrsSchema.fsrsCard)
			.innerJoin(schema.exercise, eq(fsrsSchema.fsrsCard.exerciseId, schema.exercise.id))
			.where(
				and(
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exercise.archivedAt),
					lte(fsrsSchema.fsrsCard.nextDueAt, reviewDate)
				)
			)
			.orderBy(asc(fsrsSchema.fsrsCard.nextDueAt));

		console.log('pendingExercises:', pendingExercises);
		if (pendingExercises.length > 0) return redirect(302, `/exercise/${pendingExercises[0].id}`);

		// New exercises doesn't have a FSRS card associated.
		const newExercises = await db
			.select({
				id: schema.exercise.id
			})
			.from(schema.exercise)
			.leftJoin(fsrsSchema.fsrsCard, eq(schema.exercise.id, fsrsSchema.fsrsCard.exerciseId))
			.where(
				and(
					eq(schema.exercise.userId, signedInUser.id),
					isNull(fsrsSchema.fsrsCard.id),
					// The previous conditions ensure that the exercise is new.
					// If at the time of fetching the exercise, it is archived, it means a bug happened.
					// We should handle this case gracefully.
					isNull(schema.exercise.archivedAt)
				)
			)
			.orderBy(desc(schema.exercise.createdAt));

		if (newExercises.length > 0) return redirect(302, `/exercise/${newExercises[0].id}`);

		return redirect(302, '/exercise');
	}
} satisfies Actions;
