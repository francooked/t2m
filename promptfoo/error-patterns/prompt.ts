import { buildPrompt, responseFormat } from '../../src/lib/prompts/error-patterns';
import type { Input } from '../../src/lib/prompts/error-patterns';

export default async function ({ vars }: { vars: Input }) {
	return {
		prompt: buildPrompt(vars),
		config: {
			response_format: responseFormat
		}
	};
}
