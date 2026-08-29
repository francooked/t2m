import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const CORRECT_ONE_SHOT_ID = 'correctOneShot' as const;

export const correctOneShotSuccess = defineSuccess(z.null());

export const correctOneShotFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'unexpected']) })
);
