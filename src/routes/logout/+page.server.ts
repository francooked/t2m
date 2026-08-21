import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import { createFormResponders } from '$lib/forms/result.server';
import { SIGN_OUT_ID, signOutFailure, signOutSuccess } from '$lib/forms/sign-out';

const signOutResponders = createFormResponders({
	id: SIGN_OUT_ID,
	success: signOutSuccess,
	failure: signOutFailure
});

export const load: PageServerLoad = async ({ locals }) => {
	if (!locals.user) return redirect(302, '/login');
};

export const actions = {
	signOut: async ({ request: { headers } }) => {
		try {
			await auth.api.signOut({ headers });
		} catch (error) {
			console.error(error);
			if (error instanceof APIError) {
				return signOutResponders.fail({ error: { code: 'signout_failed' }, status: 400 });
			}
			return signOutResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return redirect(303, '/login');
	}
} satisfies Actions;
