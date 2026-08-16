import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import z from 'zod';
import { LANGUAGE_CODES, TIME_ZONES } from '$lib/constants';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { generatorParameters } from 'ts-fsrs';
import { createFormResponders } from '$lib/forms/result.server';
import { SIGN_IN_ID, signInFailure, signInSuccess } from '$lib/forms/sign-in';
import { SIGN_UP_ID, signUpFailure, signUpSuccess } from '$lib/forms/sign-up';
import { SIGN_OUT_ID, signOutFailure, signOutSuccess } from '$lib/forms/sign-out';

const signUpResponders = createFormResponders({
	id: SIGN_UP_ID,
	success: signUpSuccess,
	failure: signUpFailure
});

const signInResponders = createFormResponders({
	id: SIGN_IN_ID,
	success: signInSuccess,
	failure: signInFailure
});

const signOutResponders = createFormResponders({
	id: SIGN_OUT_ID,
	success: signOutSuccess,
	failure: signOutFailure
});

export const load: PageServerLoad = async ({ locals }) => {
	if (locals.user) return redirect(302, '/chat');
};

export const actions = {
	signUpEmail: async ({ request }) => {
		const formDataSchema = z.object({
			email: z.email(),
			password: z.string().min(1),
			name: z.string().min(1),
			nativeLanguage: z.enum(LANGUAGE_CODES),
			timeZone: z.enum(TIME_ZONES)
		});
		const formData = await request.formData();
		const formDataParse = formDataSchema.safeParse({
			email: formData.get('email')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? '',
			name: formData.get('name')?.toString() ?? '',
			nativeLanguage: formData.get('native_language')?.toString() ?? '',
			timeZone: formData.get('time_zone')?.toString() ?? ''
		});

		if (formDataParse.error) {
			return signUpResponders.fail({ error: { code: 'invalid_input' }, status: 400 });
		}

		try {
			const { user } = await auth.api.signUpEmail({ body: { ...formDataParse.data } });
			await db.transaction(async (tx) => {
				await tx.insert(schema.userProfile).values({
					userId: user.id,
					nativeLanguage: formDataParse.data.nativeLanguage,
					timeZone: formDataParse.data.timeZone
				});
				const fsrsParameters = generatorParameters();
				await tx
					.insert(schema.userSrsProfile)
					.values({ userId: user.id, algorithm: 'fsrs', setup: fsrsParameters });
			});
		} catch (error) {
			if (error instanceof APIError) {
				return signUpResponders.fail({ error: { code: 'signup_failed' }, status: 400 });
			}
			return signUpResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return redirect(303, '/chat');
	},
	signInEmail: async ({ request }) => {
		const formDataSchema = z.object({
			email: z.email(),
			password: z.string().min(1)
		});
		const formData = await request.formData();
		const formDataParse = formDataSchema.safeParse({
			email: formData.get('email')?.toString() ?? '',
			password: formData.get('password')?.toString() ?? ''
		});

		if (formDataParse.error) {
			return signInResponders.fail({ error: { code: 'invalid_input' }, status: 400 });
		}

		try {
			await auth.api.signInEmail({ body: { ...formDataParse.data } });
		} catch (error) {
			if (error instanceof APIError) {
				return signInResponders.fail({ error: { code: 'signin_failed' }, status: 400 });
			}
			return signInResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return redirect(303, '/chat');
	},
	signOut: async ({ request: { headers } }) => {
		try {
			await auth.api.signOut({ headers });
		} catch (error) {
			if (error instanceof APIError) {
				return signOutResponders.fail({ error: { code: 'signout_failed' }, status: 400 });
			}
			return signOutResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return redirect(303, '/chat');
	}
} satisfies Actions;
