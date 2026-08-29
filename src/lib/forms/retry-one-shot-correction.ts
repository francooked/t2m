import * as z from 'zod';
import { defineFailure, defineSuccess } from './contract';

export const RETRY_ONE_SHOT_CORRECTION_ID = 'retryOneShotCorrection' as const;

export const retryOneShotCorrectionSuccess = defineSuccess(z.null());

export const retryOneShotCorrectionFailure = defineFailure(
	z.object({ code: z.enum(['invalid_input', 'unexpected']) })
);
