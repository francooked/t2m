import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import * as fsrsSchema from '$lib/server/db/fsrs.schema';
import { and, eq, isNull } from 'drizzle-orm';
import { parseExercisePayload } from '$lib/exercise/parse-exercise';
import { diffArrays } from 'diff';
import { tokenize } from '$lib/correction/tokenize';
import { parseExerciseCheckPayload } from '$lib/exercise/parse-exercise-check';
import { createFormResponders } from '$lib/forms/result.server';
import { RATE_ID, rateFailure, rateSuccess } from '$lib/forms/rate';
import * as z from 'zod';
import { createEmptyCard, fsrs, Rating, type StepUnit, TypeConvert } from 'ts-fsrs';
import {
	resolveNextNewExercises,
	resolveNextPendingExercises,
	resolveNextUnratedExercises
} from '$lib/server/exercise/next-exercise';

const rate = createFormResponders({
	id: RATE_ID,
	success: rateSuccess,
	failure: rateFailure
});

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const exerciseId = Number(params.id);

	const exercise = (
		await db
			.select({
				id: schema.exercise.id,
				payload: schema.exercise.payload,
				targetLanguage: schema.exercise.targetLanguage
			})
			.from(schema.exercise)
			.innerJoin(schema.userProfile, eq(schema.exercise.userId, schema.userProfile.userId))
			.where(
				and(
					eq(schema.exercise.id, exerciseId),
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exercise.archivedAt)
				)
			)
			.limit(1)
	)
		.map(({ id, targetLanguage, payload }) => ({
			id,
			targetLanguage,
			...parseExercisePayload(payload)
		}))
		.at(0);

	if (!exercise) return redirect(302, '/exercises');

	const exerciseCheck = (
		await db
			.select({
				id: schema.exerciseCheck.id,
				payload: schema.exerciseCheck.payload
			})
			.from(schema.exerciseCheck)
			.where(
				and(eq(schema.exerciseCheck.exerciseId, exerciseId), isNull(schema.exerciseCheck.ratedAt))
			)
			.limit(1)
	)
		.map(({ id, payload }) => ({
			id,
			...parseExerciseCheckPayload({ type: exercise.type, version: exercise.version, payload })
		}))
		.at(0);

	if (!exerciseCheck) return redirect(302, `/exercises/${exerciseId}`);

	if (exercise.type === 'full_answer' && exercise.version === 1) {
		const differences = diffArrays(
			tokenize(exerciseCheck.payload.answer, exercise.targetLanguage),
			tokenize(exercise.payload.back, exercise.targetLanguage)
		).map(({ added, removed, value }) => ({ added, removed, value: value.join('') }));

		return {
			review: {
				type: exercise.type,
				version: exercise.version,
				expected: exercise.payload.back,
				answer: exerciseCheck.payload.answer,
				tips: exerciseCheck.payload.tips,
				differences
			}
		};
	}

	return redirect(302, `/exercises/${exerciseId}`);
};

export const actions = {
	rate: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(303, '/login');

		const formData = await request.formData();
		const formDataSchema = z.object({
			exerciseId: z.number(),
			rating: z.enum(['again', 'hard', 'good', 'easy'])
		});
		const formDataParse = formDataSchema.safeParse({
			exerciseId: parseInt(formData.get('exercise_id')?.toString() ?? '-1'),
			rating: formData.get('rating')?.toString() ?? ''
		});

		if (!formDataParse.success) {
			return rate.fail({ error: { code: 'invalid_input' }, status: 400 });
		}

		const userProfile = (
			await db
				.select({ timeZone: schema.userProfile.timeZone })
				.from(schema.userProfile)
				.where(eq(schema.userProfile.userId, signedInUser.id))
		).at(0);

		if (!userProfile) {
			return redirect(303, '/login');
		}

		const userSrsProfile = (
			await db
				.select({ algorithm: schema.userSrsProfile.algorithm, setup: schema.userSrsProfile.setup })
				.from(schema.userSrsProfile)
				.where(and(eq(schema.userSrsProfile.userId, signedInUser.id)))
				.limit(1)
		).at(0);

		if (!userSrsProfile) return redirect(303, '/exercises');

		const exercise = (
			await db
				.select({
					id: schema.exercise.id
				})
				.from(schema.exercise)
				.where(
					and(
						eq(schema.exercise.id, formDataParse.data.exerciseId),
						eq(schema.exercise.userId, signedInUser.id),
						isNull(schema.exercise.archivedAt)
					)
				)
				.limit(1)
		).at(0);

		if (!exercise) return redirect(303, '/exercises');

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
			if (!fsrsParametersParse.success) {
				throw new Error('Invalid FSRS parameters');
			}

			const existingFsrsCard = (
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

			await db.transaction(async (tx) => {
				const exerciseCheck = (
					await tx
						.update(schema.exerciseCheck)
						.set({ ratedAt: reviewDate })
						.where(
							and(
								eq(schema.exerciseCheck.exerciseId, formDataParse.data.exerciseId),
								isNull(schema.exerciseCheck.ratedAt)
							)
						)
						.returning({ id: schema.exerciseCheck.id })
				).at(0);

				// The exercise check has already been rated.
				if (!exerciseCheck) return;

				if (!existingFsrsCard) {
					const emptyFsrsCard = createEmptyCard(reviewDate);
					const recordLogItem = scheduler.next(
						emptyFsrsCard,
						reviewDate,
						ratingToFsrsRating[formDataParse.data.rating]
					);

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
				} else {
					const recordLogItem = scheduler.next(
						// Convert the state blob to a card object.
						// Dates are stored as strings, so we need to convert them to Date objects.
						TypeConvert.card(existingFsrsCard.stateBlob),
						reviewDate,
						ratingToFsrsRating[formDataParse.data.rating]
					);

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
						fsrsCardId: existingFsrsCard.id,
						reviewedAt: reviewDate,
						rating: formDataParse.data.rating,
						stateBlob: recordLogItem.log
					});
				}
			});
		} else {
			throw new Error('Invalid SRS algorithm');
		}

		const nextUnratedExercise = (await resolveNextUnratedExercises({ userId: signedInUser.id })).at(
			0
		);

		if (nextUnratedExercise) {
			return redirect(303, `/exercises/${nextUnratedExercise.id}`);
		}

		const nextPendingExercise = (
			await resolveNextPendingExercises({
				userId: signedInUser.id,
				timeZone: userProfile.timeZone,
				reviewDate
			})
		).at(0);

		if (nextPendingExercise) {
			return redirect(303, `/exercises/${nextPendingExercise.id}`);
		}

		const nextNewExercise = (
			await resolveNextNewExercises({
				userId: signedInUser.id
			})
		).at(0);

		if (nextNewExercise) {
			return redirect(303, `/exercises/${nextNewExercise.id}`);
		}

		return redirect(303, '/exercises');
	}
} satisfies Actions;
