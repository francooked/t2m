import * as z from 'zod';
import { buildPrompt, outputSchema } from '../../src/lib/prompts/message-correction';
import type { Input } from '../../src/lib/prompts/message-correction';

export default async function ({ vars }: { vars: Input }) {
	return {
		prompt: buildPrompt(vars),
		config: {
			response_format: {
				type: 'json_schema',
				json_schema: {
					name: 'message_correction',
					strict: false,
					schema: z.toJSONSchema(outputSchema, { io: 'input' })
				}
			}
		}
	};
}
