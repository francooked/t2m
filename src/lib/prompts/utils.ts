import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat.js';

export type PromptFn<I, O> = (input: I, options: O) => ChatCompletionMessageParam[];
