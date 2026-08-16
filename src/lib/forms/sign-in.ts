import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const SIGN_IN_ID = 'signIn' as const;

export const signInSuccess = defineSuccess(z.null());

export const signInFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'signin_failed', 'unexpected']) })
);
