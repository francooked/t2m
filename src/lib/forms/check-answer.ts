import * as z from 'zod';

import { defineSuccess, defineFailure } from './contract';

export const CHECK_ANSWER_ID = 'checkAnswer' as const;

export const checkAnswerSuccess = defineSuccess(
	z.object({
		expected: z.string(),
		answer: z.string(),
		tips: z.array(z.string()),
		differences: z.array(
			z.object({
				added: z.boolean().optional(),
				removed: z.boolean().optional(),
				value: z.string()
			})
		)
	})
);

export const checkAnswerFailure = defineFailure(
	z.object({
		code: z.enum([
			'invalid_input',
			'llm_invalid_response',
			'invalid_exercise_type_or_version',
			'chat_turn_error',
			'unexpected'
		])
	})
);

export type CheckAnswerSuccess = z.infer<typeof checkAnswerSuccess>;
