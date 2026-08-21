import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const REPLY_AND_CORRECT_ID = 'replyAndCorrect' as const;

export const replyAndCorrectSuccess = defineSuccess(z.null());

export const replyAndCorrectFailure = defineFailure(
	z.object({
		code: z.enum(['invalid_input', 'chat_not_found', 'unexpected'])
	})
);
