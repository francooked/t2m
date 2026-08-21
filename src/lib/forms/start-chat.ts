import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const START_CHAT_ID = 'startChat' as const;

export const startChatSuccess = defineSuccess(z.null());

export const startChatFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'unexpected']) })
);
