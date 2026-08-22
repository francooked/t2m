import * as z from 'zod';

import { defineSuccess, defineFailure } from './contract';

export const RATE_ID = 'rate' as const;

export const rateSuccess = defineSuccess(z.null());

export const rateFailure = defineFailure(
	z.object({
		code: z.enum(['invalid_input'])
	})
);
