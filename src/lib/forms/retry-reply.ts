import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const RETRY_REPLY_ID = 'retryReply' as const;

export const retryReplySuccess = defineSuccess(z.null());

export const retryReplyFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'chat_turn_error', 'unexpected']) })
);
