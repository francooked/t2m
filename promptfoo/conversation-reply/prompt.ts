import { buildPrompt } from '../../src/lib/prompts/conversation-reply';
import type { Input } from '../../src/lib/prompts/conversation-reply';

export default async function ({ vars }: { vars: Input }) {
	return {
		prompt: buildPrompt(vars)
	};
}
