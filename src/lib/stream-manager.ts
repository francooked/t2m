import {
	readable,
	writable,
	type Readable,
	type Subscriber,
	type Unsubscriber,
	type Writable
} from 'svelte/store';
import { parseNdjson } from './utils';
import type { StreamEvent } from './server/stream-events';
import z from 'zod';

export type ReplyState =
	| { status: 'idle'; content: '' }
	| { status: 'streaming'; content: string }
	| { status: 'done'; content: string }
	| { status: 'error'; content: string; message: string }
	| { status: 'aborted'; content: string };

export class ReplyStream {
	controller: AbortController;
	data: Readable<ReplyState>;

	constructor({ chatId, messageId }: { chatId: number; messageId: number }) {
		this.controller = new AbortController();
		this.data = readable<ReplyState>({ status: 'idle', content: '' }, (set, update) => {
			(async () => {
				try {
					const response = await fetch('/api/stream/reply', {
						method: 'post',
						body: JSON.stringify({
							chatId,
							messageId
						}),
						signal: this.controller.signal
					});
					if (!response.body) throw new Error('No response body.');

					const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
					while (true) {
						const { value, done } = await reader.read();
						if (done) {
							update((value) => ({ status: 'done', content: value.content }));
							break;
						}
						if (!value) throw new Error('Stream chunk is empty.');

						const streamEvents = parseNdjson<StreamEvent>(value);
						if (!streamEvents) throw new Error('Invalid stream events.');

						for (const streamEvent of streamEvents) {
							if (streamEvent.type === 'chunk' && streamEvent.content) {
								update((value) => ({
									status: 'streaming',
									content: value.content + streamEvent.content
								}));
							}
						}
					}
				} catch (error) {
					if (error instanceof Error && error.name === 'AbortError') {
						update((value) => ({ status: 'aborted', content: value.content }));
					} else {
						update((value) => ({
							status: 'error',
							content: value.content,
							message: String(error)
						}));
					}
				}
			})();

			return () => this.stop();
		});
	}

	stop() {
		this.controller.abort();
	}

	subscribe(run: Subscriber<ReplyState>): Unsubscriber {
		return this.data.subscribe(run);
	}
}

export type CorrectState =
	| { status: 'idle'; content: '' }
	| { status: 'streaming'; content: string }
	| { status: 'done'; content: string }
	| { status: 'error'; content: string; message: string }
	| { status: 'aborted'; content: string };

export class CorrectStream {
	controller: AbortController;
	data: Readable<CorrectState>;

	constructor({ chatId, messageId }: { chatId: number; messageId: number }) {
		this.controller = new AbortController();
		this.data = readable<CorrectState>({ status: 'idle', content: '' }, (set, update) => {
			(async () => {
				try {
					const response = await fetch('/api/stream/correct', {
						method: 'post',
						body: JSON.stringify({
							chatId,
							messageId
						}),
						signal: this.controller.signal
					});
					if (!response.body) throw new Error('No response body.');

					const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
					while (true) {
						const { value, done } = await reader.read();
						if (done) {
							update((value) => {
								const zodSchema = z.array(
									z.object({
										fragment: z.string().min(1),
										reason: z.string().min(1),
										suggestions: z.array(z.object({ replacement: z.string().min(1) }))
									})
								);
								const { success } = zodSchema.safeParse(JSON.parse(value.content as string));
								if (!success) {
									throw new Error('Invalid JSON response from LLM.');
								}

								return { status: 'done', content: value.content };
							});
							break;
						}
						if (!value) throw new Error('Stream chunk is empty.');

						const streamEvents = parseNdjson<StreamEvent>(value);
						if (!streamEvents) throw new Error('Invalid stream events.');

						for (const streamEvent of streamEvents) {
							if (streamEvent.type === 'chunk' && streamEvent.content) {
								update((value) => ({
									status: 'streaming',
									content: value.content + streamEvent.content
								}));
							}
						}
					}
				} catch (error) {
					if (error instanceof Error && error.name === 'AbortError') {
						update((value) => ({ status: 'aborted', content: value.content }));
					} else {
						update((value) => ({
							status: 'error',
							content: value.content,
							message: String(error)
						}));
					}
				}
			})();

			return () => this.stop();
		});
	}

	stop() {
		this.controller.abort();
	}

	subscribe(run: Subscriber<CorrectState>): Unsubscriber {
		return this.data.subscribe(run);
	}
}

export class ReplyStreamManager {
	replyStreamMap: Map<number, ReplyStream>;
	unsubscriberMap: Map<number, Unsubscriber>;
	valueMap: Writable<Map<number, ReplyState>>;

	constructor() {
		this.replyStreamMap = new Map();
		this.unsubscriberMap = new Map();
		this.valueMap = writable(new Map());
	}

	start({ chatId, messageId }: { chatId: number; messageId: number }) {
		if (this.replyStreamMap.has(messageId)) return;

		const replyStream = new ReplyStream({ chatId, messageId });
		this.replyStreamMap.set(messageId, replyStream);

		const unsubscriber = replyStream.subscribe((value) => {
			this.valueMap.update((valueMap) => {
				valueMap.set(messageId, value);
				return valueMap;
			});
		});
		this.unsubscriberMap.set(messageId, unsubscriber);
	}

	stop({ messageId }: { chatId: number; messageId: number }) {
		const replyStream = this.replyStreamMap.get(messageId);
		const unsubscriber = this.unsubscriberMap.get(messageId);
		if (!replyStream || !unsubscriber) return;

		replyStream.stop();
		unsubscriber();
		this.valueMap.update((valueMap) => {
			valueMap.delete(messageId);
			return valueMap;
		});
	}

	subscribe(run: Subscriber<Map<number, ReplyState>>): Unsubscriber {
		return this.valueMap.subscribe(run);
	}
}

export class CorrectStreamManager {
	correctStreamMap: Map<number, CorrectStream>;
	unsubscriberMap: Map<number, Unsubscriber>;
	valueMap: Writable<Map<number, CorrectState>>;

	constructor() {
		this.correctStreamMap = new Map();
		this.unsubscriberMap = new Map();
		this.valueMap = writable(new Map());
	}

	start({ chatId, messageId }: { chatId: number; messageId: number }) {
		if (this.correctStreamMap.has(messageId)) return;

		const correctStream = new CorrectStream({ chatId, messageId });
		this.correctStreamMap.set(messageId, correctStream);

		const unsubscriber = correctStream.subscribe((value) => {
			this.valueMap.update((valueMap) => {
				valueMap.set(messageId, value);
				return valueMap;
			});
		});
		this.unsubscriberMap.set(messageId, unsubscriber);
	}

	stop({ messageId }: { chatId: number; messageId: number }) {
		const replyStream = this.correctStreamMap.get(messageId);
		const unsubscriber = this.unsubscriberMap.get(messageId);
		if (!replyStream || !unsubscriber) return;

		replyStream.stop();
		unsubscriber();
		this.valueMap.update((valueMap) => {
			valueMap.delete(messageId);
			return valueMap;
		});
	}

	subscribe(run: Subscriber<Map<number, CorrectState>>): Unsubscriber {
		return this.valueMap.subscribe(run);
	}
}
