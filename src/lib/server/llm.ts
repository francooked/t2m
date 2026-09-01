import { LLM_MODEL, OPENAI_API_KEY } from '$env/static/private';
import OpenAI from 'openai';
import * as z from 'zod';

export { LLM_MODEL };
export const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

/** Unusable model output. `reason` and `content` are for logs; actions map any throw to `unexpected`. */
export class LlmInvalidResponseError extends Error {
	constructor(
		public reason: 'empty' | 'invalid_json' | 'invalid_schema',
		public content: unknown
	) {
		super(reason);
	}
}

export function parseLlmResponse<T extends z.ZodType>(content: unknown, schema: T) {
	if (typeof content !== 'string' || content.length === 0) {
		throw new LlmInvalidResponseError('empty', content);
	}

	let json: unknown;

	try {
		json = JSON.parse(content);
	} catch {
		throw new LlmInvalidResponseError('invalid_json', content);
	}

	const parsed = schema.safeParse(json);

	if (!parsed.success) {
		throw new LlmInvalidResponseError('invalid_schema', content);
	}

	return parsed.data;
}
