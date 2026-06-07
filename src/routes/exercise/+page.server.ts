import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	narrowExercisePayload,
	type SelectFnMap
} from '$lib/server/exercise/narrow-exercise-payload';
import {
	resolveNextNewExercises,
	resolveNextPendingExercises
} from '$lib/server/exercise/next-exercise';

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const userProfile = (
		await db
			.select({ timeZone: schema.userProfile.timeZone })
			.from(schema.userProfile)
			.where(eq(schema.userProfile.userId, signedInUser.id))
	).at(0);

	if (!userProfile) {
		return redirect(302, '/login');
	}

	const selectFn = {
		full_answer: {
			1: ({ front, extra }) => ({ front, extra })
		}
	} satisfies SelectFnMap;

	const reviewDate = new Date();

	const pendingExercises = (
		await resolveNextPendingExercises({
			userId: signedInUser.id,
			timeZone: userProfile.timeZone,
			reviewDate
		})
	).map((row) => narrowExercisePayload(row, selectFn));

	// New exercises doesn't have a FSRS card associated.
	const newExercises = (
		await resolveNextNewExercises({
			userId: signedInUser.id
		})
	).map((row) => narrowExercisePayload(row, selectFn));

	return { newExercises, pendingExercises };
};
