import * as z from 'zod';

import { defineSuccess, defineFailure } from './contract';

export const ANSWER_EXERCISE_ID = 'answerExercise' as const;

export const answerExerciseSuccess = defineSuccess(z.null());

export const answerExerciseFailure = defineFailure(
	z.object({
		code: z.enum(['invalid_input'])
	})
);
