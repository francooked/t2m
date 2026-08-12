import * as z from 'zod';

export const SIGN_IN_ID = 'signIn' as const;

export const signInFormKeys = [
	{ name: 'email', method: 'get', default: '' },
	{ name: 'password', method: 'get', default: '' }
];

export const signInFormSchema = z.object({ email: z.email(), password: z.string().min(1) });

export type SignInFormData = z.infer<typeof signInFormSchema>;
