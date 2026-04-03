import { redirect } from '@sveltejs/kit';
import type { LayoutServerLoad } from './$types';
import * as authSchema from '$lib/server/db/auth.schema';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';

export const load: LayoutServerLoad = ({ locals }) => {
	if (!locals.user) return redirect(302, '/login');
	return { user: locals.user as typeof authSchema.user.$inferSelect };
};
