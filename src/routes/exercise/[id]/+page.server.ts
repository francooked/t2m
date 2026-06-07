import { requireUserSession } from '$lib/server/session-user';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import * as fsrsSchema from '$lib/server/db/fsrs.schema';
import { db } from '$lib/server/db';
import { and, eq, isNull } from 'drizzle-orm';
import {
	narrowExercisePayload,
	type SelectFnMap
} from '$lib/server/exercise/narrow-exercise-payload';
import z from 'zod';
import Groq from 'groq-sdk';
import { GROQ_API_KEY } from '$env/static/private';
import { prompts, translationFeedbackSchema } from '$lib/prompts/translation-feedback';
import { createEmptyCard, fsrs, Rating, type StepUnit } from 'ts-fsrs';
import {
	resolveNextNewExercises,
	resolveNextPendingExercises
} from '$lib/server/exercise/next-exercise';

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const selectFn = {
		full_answer: {
			1: ({ front, extra }) => ({ front, extra })
		}
	} satisfies SelectFnMap;

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
					eq(schema.exercise.id, parseInt(params.id)),
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exercise.archivedAt)
				)
			)
	)
		.map((row) => narrowExercisePayload(row, selectFn))
		.at(0);

	if (!exercise) return redirect(302, '/exercise');

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

		if (!formDataParse.success) return fail(400, { code: 'invalid_input' });

		const selectFn = {
			full_answer: {
				1: ({ front, back, extra }) => ({ front, back, extra })
			}
		} satisfies SelectFnMap;

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
			.map(({ targetLanguage, nativeLanguage, ...rest }) => ({
				targetLanguage,
				nativeLanguage,
				...narrowExercisePayload(rest, selectFn)
			}))
			.at(0);

		if (!exercise) return redirect(302, '/exercise');

		if (exercise.type === 'full_answer' && exercise.version === 1) {
			const groqClient = new Groq({ apiKey: GROQ_API_KEY });
			const chatCompletionContent = (
				await groqClient.chat.completions.create({
					messages: prompts(
						{
							original: exercise.payload.extra,
							expected: exercise.payload.back,
							answer: formDataParse.data.answer
						},
						{
							nativeLanguage: exercise.nativeLanguage,
							targetLanguage: exercise.targetLanguage
						}
					),
					model: 'openai/gpt-oss-20b',
					temperature: 0.5,
					max_completion_tokens: 4096,
					top_p: 1,
					stop: null
				})
			).choices.at(0)?.message.content;

			if (!chatCompletionContent) {
				return fail(500, { code: 'invalid_llm_response' });
			}

			try {
				const translationFeedbackParse = translationFeedbackSchema.safeParse(
					await JSON.parse(chatCompletionContent)
				);
				if (!translationFeedbackParse.success) {
					return fail(500, { code: 'invalid_llm_response' });
				}
				return {
					tips: translationFeedbackParse.data.tips,
					expected: exercise.payload.back,
					answer: formDataParse.data.answer
				};
			} catch {
				return fail(500, { code: 'invalid_llm_response' });
			}
		} else {
			return fail(400, { code: 'invalid_exercise_type_or_version' });
		}
	},
	answerExercise: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const formData = await request.formData();
		const formDataSchema = z.object({
			exerciseId: z.number(),
			rating: z.enum(['again', 'hard', 'good', 'easy'])
		});
		const formDataParse = formDataSchema.safeParse({
			exerciseId: parseInt(formData.get('exercise_id')?.toString() ?? '-1'),
			rating: formData.get('rating')?.toString() ?? ''
		});

		if (!formDataParse.success) return fail(400, { code: 'invalid_input' });

		const userProfile = (
			await db
				.select({ timeZone: schema.userProfile.timeZone })
				.from(schema.userProfile)
				.where(eq(schema.userProfile.userId, signedInUser.id))
		).at(0);

		if (!userProfile) {
			return redirect(302, '/login');
		}

		const userSrsProfile = (
			await db
				.select({ algorithm: schema.userSrsProfile.algorithm, setup: schema.userSrsProfile.setup })
				.from(schema.userSrsProfile)
				.where(and(eq(schema.userSrsProfile.userId, signedInUser.id)))
				.limit(1)
		).at(0);

		if (!userSrsProfile) return redirect(302, '/exercise');

		const reviewDate = new Date();

		if (userSrsProfile.algorithm === 'fsrs') {
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

			const fsrsParametersParse = fsrsParametersSchema.safeParse(userSrsProfile.setup);
			if (!fsrsParametersParse.success) return fail(400, { code: 'invalid_fsrs_parameters' });

			const fsrsCard = (
				await db
					.select({
						id: fsrsSchema.fsrsCard.id,
						stateBlob: fsrsSchema.fsrsCard.stateBlob,
						nextDueAt: fsrsSchema.fsrsCard.nextDueAt
					})
					.from(fsrsSchema.fsrsCard)
					.where(
						and(
							eq(fsrsSchema.fsrsCard.userId, signedInUser.id),
							eq(fsrsSchema.fsrsCard.exerciseId, formDataParse.data.exerciseId)
						)
					)
					.limit(1)
			).at(0);

			const ratingToFsrsRating = {
				again: Rating.Again,
				hard: Rating.Hard,
				good: Rating.Good,
				easy: Rating.Easy
			} as const;

			const scheduler = fsrs(fsrsParametersParse.data);

			if (!fsrsCard) {
				const emptyFsrsCard = createEmptyCard(reviewDate);
				const recordLogItem = scheduler.next(
					emptyFsrsCard,
					reviewDate,
					ratingToFsrsRating[formDataParse.data.rating]
				);

				await db.transaction(async (tx) => {
					const fsrsCard = (
						await tx
							.insert(fsrsSchema.fsrsCard)
							.values({
								userId: signedInUser.id,
								exerciseId: formDataParse.data.exerciseId,
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
						rating: formDataParse.data.rating,
						stateBlob: recordLogItem.log
					});
				});
			} else {
				const recordLogItem = scheduler.next(
					fsrsCard.stateBlob,
					reviewDate,
					ratingToFsrsRating[formDataParse.data.rating]
				);

				await db.transaction(async (tx) => {
					await tx
						.update(fsrsSchema.fsrsCard)
						.set({ stateBlob: recordLogItem.card, nextDueAt: recordLogItem.card.due })
						.where(
							and(
								eq(fsrsSchema.fsrsCard.userId, signedInUser.id),
								eq(fsrsSchema.fsrsCard.exerciseId, formDataParse.data.exerciseId)
							)
						);
					await tx.insert(fsrsSchema.fsrsReviewLog).values({
						userId: signedInUser.id,
						fsrsCardId: fsrsCard.id,
						reviewedAt: reviewDate,
						rating: formDataParse.data.rating,
						stateBlob: recordLogItem.log
					});
				});
			}
		} else {
			return fail(400, { code: 'invalid_srs_algorithm' });
		}

		const nextPendingExercise = (
			await resolveNextPendingExercises({
				userId: signedInUser.id,
				timeZone: userProfile.timeZone,
				reviewDate
			})
		).at(0);

		if (nextPendingExercise) {
			return redirect(302, `/exercise/${nextPendingExercise.id}`);
		}

		const nextNewExercise = (
			await resolveNextNewExercises({
				userId: signedInUser.id
			})
		).at(0);

		if (nextNewExercise) {
			return redirect(302, `/exercise/${nextNewExercise.id}`);
		}

		return redirect(302, '/exercise');
	}
} satisfies Actions;
