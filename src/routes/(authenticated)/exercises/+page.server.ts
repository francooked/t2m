import { requireUserSession } from '$lib/server/session-user';
import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import {
	resolveNextNewExercises,
	resolveNextPendingExercises,
	resolveNextUnratedExercises
} from '$lib/server/exercise/next-exercise';
import { parseExercisePayload, toPublicExercisePayload } from '$lib/exercise/parse-exercise';

export const load: PageServerLoad = async ({ locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const reviewDate = new Date();

	const unratedExercises = (await resolveNextUnratedExercises({ userId: signedInUser.id })).map(
		({ id, payload }) => ({ id, ...toPublicExercisePayload(parseExercisePayload(payload)) })
	);

	const pendingExercises = (
		await resolveNextPendingExercises({
			userId: signedInUser.id,
			timeZone: signedInUser.timeZone,
			reviewDate
		})
	).map(({ id, payload }) => ({ id, ...toPublicExercisePayload(parseExercisePayload(payload)) }));

	// New exercises doesn't have a FSRS card associated.
	const newExercises = (
		await resolveNextNewExercises({
			userId: signedInUser.id
		})
	).map(({ id, payload }) => ({ id, ...toPublicExercisePayload(parseExercisePayload(payload)) }));

	const nextExercise =
		unratedExercises.at(0) ?? pendingExercises.at(0) ?? newExercises.at(0) ?? null;

	return { newExercises, pendingExercises, unratedExercises, nextExercise };
};
