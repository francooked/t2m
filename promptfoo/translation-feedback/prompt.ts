import { buildPrompt } from '../../src/lib/prompts/translation-feedback';
import type { Input } from '../../src/lib/prompts/translation-feedback';

export default async function ({ vars }: { vars: Input }) {
	return {
		prompt: buildPrompt(vars)
	};
}
