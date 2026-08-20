import * as schema from '$lib/server/db/schema';
import * as fsrsSchema from '$lib/server/db/fsrs.schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { and, asc, eq, isNull, lt } from 'drizzle-orm';
import { db } from '$lib/server/db';
import { startOfTomorrowInTimeZone } from '$lib/date';

/** Oldest open review (answered, not rated). */
export async function resolveNextUnratedExercises({
	userId
}: {
	userId: (typeof authSchema.user.$inferSelect)['id'];
}) {
	const unratedExercises = await db
		.select({
			id: schema.exercise.id,
			type: schema.exercise.type,
			version: schema.exercise.version,
			payload: schema.exercise.payload
		})
		.from(schema.exerciseCheck)
		.innerJoin(schema.exercise, eq(schema.exerciseCheck.exerciseId, schema.exercise.id))
		.where(
			and(
				eq(schema.exercise.userId, userId),
				isNull(schema.exercise.archivedAt),
				isNull(schema.exerciseCheck.ratedAt)
			)
		)
		.orderBy(asc(schema.exerciseCheck.createdAt));

	return unratedExercises;
}

export async function resolveNextPendingExercises({
	userId,
	timeZone,
	reviewDate
}: {
	userId: (typeof authSchema.user.$inferSelect)['id'];
	timeZone: (typeof schema.userProfile.$inferSelect)['timeZone'];
	reviewDate: Date;
}) {
	const endOfStudyDay = startOfTomorrowInTimeZone(reviewDate, timeZone);
	const pendingExercises = await db
		.select({
			id: schema.exercise.id,
			type: schema.exercise.type,
			version: schema.exercise.version,
			payload: schema.exercise.payload
		})
		.from(fsrsSchema.fsrsCard)
		.innerJoin(schema.exercise, eq(fsrsSchema.fsrsCard.exerciseId, schema.exercise.id))
		.leftJoin(
			schema.exerciseCheck,
			and(
				eq(schema.exercise.id, schema.exerciseCheck.exerciseId),
				isNull(schema.exerciseCheck.ratedAt)
			)
		)
		.where(
			and(
				eq(schema.exercise.userId, userId),
				isNull(schema.exercise.archivedAt),
				lt(fsrsSchema.fsrsCard.nextDueAt, endOfStudyDay),
				isNull(schema.exerciseCheck.id)
			)
		)
		.orderBy(asc(fsrsSchema.fsrsCard.nextDueAt));

	return pendingExercises;
}

export async function resolveNextNewExercises({
	userId
}: {
	userId: (typeof authSchema.user.$inferSelect)['id'];
}) {
	// New exercises doesn't have a FSRS card associated.
	const newExercises = await db
		.select({
			id: schema.exercise.id,
			type: schema.exercise.type,
			version: schema.exercise.version,
			payload: schema.exercise.payload
		})
		.from(schema.exercise)
		.leftJoin(fsrsSchema.fsrsCard, eq(schema.exercise.id, fsrsSchema.fsrsCard.exerciseId))
		.leftJoin(
			schema.exerciseCheck,
			and(
				eq(schema.exercise.id, schema.exerciseCheck.exerciseId),
				isNull(schema.exerciseCheck.ratedAt)
			)
		)
		.where(
			and(
				eq(schema.exercise.userId, userId),
				isNull(fsrsSchema.fsrsCard.id),
				// The previous conditions ensure that the exercise is new.
				// If at the time of fetching the exercise, it is archived, it means a bug happened.
				// We should handle this case gracefully.
				isNull(schema.exercise.archivedAt),
				isNull(schema.exerciseCheck.id)
			)
		)
		.orderBy(asc(schema.exercise.createdAt));

	return newExercises;
}
