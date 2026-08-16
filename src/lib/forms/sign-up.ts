import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const SIGN_UP_ID = 'signUp' as const;

export const signUpSuccess = defineSuccess(z.null());

export const signUpFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'signup_failed', 'unexpected']) })
);
