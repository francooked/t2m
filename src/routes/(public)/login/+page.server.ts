import { redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import z from 'zod';
import { LANGUAGE_CODES } from '$lib/constants';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { generatorParameters } from 'ts-fsrs';
import { createFormResponders } from '$lib/forms/result.server';
import { SIGN_IN_ID, signInFailure, signInSuccess } from '$lib/forms/sign-in';
import { SIGN_UP_ID, signUpFailure, signUpSuccess } from '$lib/forms/sign-up';
import { requireUserSession } from '$lib/server/session-user';

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

export const load: PageServerLoad = async ({ locals }) => {
	const signedInUser = requireUserSession(locals);
	if (signedInUser) return redirect(302, '/chats');
};

export const actions = {
	signUpEmail: async ({ request }) => {
		const formDataSchema = z.object({
			email: z.email(),
			password: z.string().min(1),
			name: z.string().min(1),
			nativeLanguage: z.enum(LANGUAGE_CODES),
			timeZone: z.string().min(1)
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
			const fsrsParameters = generatorParameters();
			await db
				.insert(schema.userSrsProfile)
				.values({ userId: user.id, algorithm: 'fsrs', setup: fsrsParameters });
		} catch (error) {
			console.error(error);
			if (error instanceof APIError) {
				return signUpResponders.fail({ error: { code: 'signup_failed' }, status: 400 });
			}
			return signUpResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return redirect(303, '/chats');
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
			console.error(error);
			if (error instanceof APIError) {
				return signInResponders.fail({ error: { code: 'signin_failed' }, status: 400 });
			}
			return signInResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return redirect(303, '/chats');
	}
} satisfies Actions;
