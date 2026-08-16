import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const DELETE_CHAT_ID = 'deleteChat' as const;

export const deleteChatSuccess = defineSuccess(z.null());

export const deleteChatFailure = defineFailure(z.object({ code: z.enum(['invalid_input']) }));
