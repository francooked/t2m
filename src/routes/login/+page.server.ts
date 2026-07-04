import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { auth } from '$lib/server/auth';
import { APIError } from 'better-auth/api';
import z from 'zod';
import { LANGUAGE_CODES, TIME_ZONES } from '$lib/constants';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { generatorParameters } from 'ts-fsrs';

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

		if (formDataParse.error) return fail(400, { code: 'invalid_form' });

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
				return fail(400, { code: 'signup_failed', message: error.message || 'Signup failed' });
			}
			return fail(500, { code: 'unexpected' });
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

		if (formDataParse.error) return fail(400, { code: 'invalid_form' });

		try {
			await auth.api.signInEmail({ body: { ...formDataParse.data } });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { code: 'signin_failed', message: error.message || 'Signin failed' });
			}
			return fail(500, { code: 'unexpected' });
		}

		return redirect(303, '/chat');
	},
	signOut: async ({ request: { headers } }) => {
		try {
			await auth.api.signOut({ headers });
		} catch (error) {
			if (error instanceof APIError) {
				return fail(400, { code: 'signout_failed' });
			}
			return fail(500, { code: 'unexpected' });
		}

		return redirect(303, '/chat');
	}
} satisfies Actions;
