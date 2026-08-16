import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const SIGN_OUT_ID = 'signOut' as const;

export const signOutSuccess = defineSuccess(z.null());

export const signOutFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'signout_failed', 'unexpected']) })
);
