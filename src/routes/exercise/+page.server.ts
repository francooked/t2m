import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import * as fsrsSchema from '$lib/server/db/fsrs.schema';
import { and, asc, eq, isNull, lte } from 'drizzle-orm';
import {
	narrowExercisePayload,
	type SelectFnMap
} from '$lib/server/exercise/narrow-exercise-payload';

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const selectFn = {
		full_answer: {
			1: ({ front }) => ({ front }),
			2: ({ front, extra }) => ({ front, extra })
		}
	} satisfies SelectFnMap;

	// New exercises doesn't have a FSRS card associated.
	const newExercises = (
		await db
			.select({
				id: schema.exercise.id,
				type: schema.exercise.type,
				version: schema.exercise.version,
				payload: schema.exercise.payload
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
			.orderBy(asc(schema.exercise.createdAt))
	).map((row) => narrowExercisePayload(row, selectFn));

	const pendingExercises = (
		await db
			.select({
				id: schema.exercise.id,
				type: schema.exercise.type,
				version: schema.exercise.version,
				payload: schema.exercise.payload
			})
			.from(fsrsSchema.fsrsCard)
			.innerJoin(schema.exercise, eq(fsrsSchema.fsrsCard.exerciseId, schema.exercise.id))
			.where(
				and(
					eq(schema.exercise.userId, signedInUser.id),
					isNull(schema.exercise.archivedAt),
					lte(fsrsSchema.fsrsCard.nextDueAt, new Date())
				)
			)
			.orderBy(asc(fsrsSchema.fsrsCard.nextDueAt))
	).map((row) => narrowExercisePayload(row, selectFn));

	return { newExercises, pendingExercises };
};
