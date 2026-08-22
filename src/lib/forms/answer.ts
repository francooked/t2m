import * as z from 'zod';

import { defineSuccess, defineFailure } from './contract';

export const ANSWER_ID = 'answer' as const;

export const answerSuccess = defineSuccess(z.null());

export const answerFailure = defineFailure(
	z.object({
		code: z.enum(['invalid_input', 'unexpected'])
	})
);
