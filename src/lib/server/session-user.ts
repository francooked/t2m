import type { auth } from './auth';

export function requireUserSession(locals: App.Locals) {
	if (!locals.user) return null;
	return locals.user as typeof auth.$Infer.Session.user;
}
