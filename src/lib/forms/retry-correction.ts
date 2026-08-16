import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const RETRY_CORRECTION_ID = 'retryCorrection' as const;

export const retryCorrectionSuccess = defineSuccess(z.null());

export const retryCorrectionFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'chat_turn_error', 'unexpected']) })
);
