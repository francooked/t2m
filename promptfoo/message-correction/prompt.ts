import { buildPrompt, responseFormat } from '../../src/lib/prompts/message-correction';
import type { Input } from '../../src/lib/prompts/message-correction';

export default async function ({ vars }: { vars: Input }) {
	return {
		prompt: buildPrompt(vars),
		config: {
			response_format: responseFormat
		}
	};
}
