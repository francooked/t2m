import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import z from 'zod';
import { LANGUAGE_CODES, TIME_ZONES } from '$lib/constants';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { generatorParameters } from 'ts-fsrs';
import { formFail } from '$lib/forms/result.server';
import { SIGN_IN_ID } from '$lib/forms/sign-in';
import { SIGN_UP_ID } from '$lib/forms/sign-up';
import { SIGN_OUT_ID } from '$lib/forms/sign-out';

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
			return formFail({ id: SIGN_UP_ID, code: 'invalid_form_data', status: 400 });
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
				return formFail({ id: SIGN_UP_ID, code: 'signup_failed', status: 400 });
			}
			return formFail({ id: SIGN_UP_ID, code: 'unexpected', status: 500 });
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
			return formFail({ id: SIGN_IN_ID, code: 'invalid_form_data', status: 400 });
		}

		try {
			await auth.api.signInEmail({ body: { ...formDataParse.data } });
		} catch (error) {
			if (error instanceof APIError) {
				return formFail({ id: SIGN_IN_ID, code: 'signin_failed', status: 400 });
			}
			return formFail({ id: SIGN_IN_ID, code: 'unexpected', status: 500 });
		}

		return redirect(303, '/chat');
	},
	signOut: async ({ request: { headers } }) => {
		try {
			await auth.api.signOut({ headers });
		} catch (error) {
			if (error instanceof APIError) {
				return formFail({ id: SIGN_OUT_ID, code: 'signout_failed', status: 400 });
			}
			return formFail({ id: SIGN_OUT_ID, code: 'unexpected', status: 500 });
		}

		return redirect(303, '/chat');
	}
} satisfies Actions;
