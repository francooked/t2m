import z from 'zod';

export function requireUserSession(locals: App.Locals) {
	if (!locals.user) return null;
	const schema = z.object({ id: z.string() });
	const { data: signedInUser } = schema.safeParse(locals.user);
	return signedInUser ?? null;
}
