import * as z from 'zod';

import { defineSuccess, defineFailure } from './contract';

export const CHECK_ANSWER_ID = 'checkAnswer' as const;

export const checkAnswerSuccess = defineSuccess(z.null());

export const checkAnswerFailure = defineFailure(
	z.object({
		code: z.enum(['invalid_input', 'unexpected'])
	})
);

export type CheckAnswerSuccess = z.infer<typeof checkAnswerSuccess>;
