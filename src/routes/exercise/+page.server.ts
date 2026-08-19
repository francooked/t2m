import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import {
	resolveNextNewExercises,
	resolveNextPendingExercises
} from '$lib/server/exercise/next-exercise';
import { parseExercisePayload, toPublicExercisePayload } from '$lib/exercise/parse-exercise';

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

	const reviewDate = new Date();

	const pendingExercises = (
		await resolveNextPendingExercises({
			userId: signedInUser.id,
			timeZone: userProfile.timeZone,
			reviewDate
		})
	).map(({ id, ...rest }) => ({ id, ...toPublicExercisePayload(parseExercisePayload(rest)) }));

	// New exercises doesn't have a FSRS card associated.
	const newExercises = (
		await resolveNextNewExercises({
			userId: signedInUser.id
		})
	).map(({ id, ...rest }) => ({ id, ...toPublicExercisePayload(parseExercisePayload(rest)) }));

	return { newExercises, pendingExercises };
};
