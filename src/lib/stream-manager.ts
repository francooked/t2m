import {
	readable,
	writable,
	type Readable,
	type Subscriber,
	type Unsubscriber
} from 'svelte/store';
import { streamEventSchema, type StreamEvent } from './stream-events';
import { messageCorrectionResponseSchema } from './prompts/message-correction';

function parseStreamEventLine(line: string): StreamEvent {
	let parsed: unknown;

	try {
		parsed = JSON.parse(line);
	} catch {
		throw new Error(`Invalid NDJSON event: ${line}`);
	}

	const result = streamEventSchema.safeParse(parsed);
	if (!result.success) {
		throw new Error(`Invalid stream event shape: ${line}`);
	}

	return result.data;
}

export type TextStreamState =
	| { status: 'idle'; content: '' }
	| { status: 'streaming'; content: string }
	| { status: 'done'; content: string }
	| { status: 'error'; content: string; message: string }
	| { status: 'aborted'; content: string };

class RedisTextStream {
	private controller: AbortController;
	data: Readable<TextStreamState>;

	constructor({ url, chatId, messageId }: { url: string; chatId: number; messageId: number }) {
		this.controller = new AbortController();
		this.data = readable<TextStreamState>({ status: 'idle', content: '' }, (set) => {
			let content = '';

			(async () => {
				try {
					const response = await fetch(url, {
						method: 'post',
						body: JSON.stringify({
							chatId,
							messageId
						}),
						signal: this.controller.signal
					});
					if (!response.ok) {
						throw new Error(`Stream request failed with status ${response.status}.`);
					}
					if (!response.body) {
						throw new Error('No response body.');
					}

					const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();

					let buffer = '';
					let receivedDoneEvent = false;
					while (!receivedDoneEvent) {
						const { value, done } = await reader.read();
						if (done) {
							if (buffer.trim() !== '') {
								throw new Error(`Stream ended with incomplete NDJSON event: ${buffer}`);
							}
							throw new Error(`Stream ended before done event.`);
						}
						if (!value) continue;

						buffer += value;

						let newLineIndex: number;
						while ((newLineIndex = buffer.indexOf('\n')) !== -1) {
							const line = buffer.slice(0, newLineIndex).trim();
							buffer = buffer.slice(newLineIndex + 1);
							if (line === '') continue;

							const streamEvent = parseStreamEventLine(line);

							if (streamEvent.type === 'error') {
								throw new Error(
									`Stream event failed (${streamEvent.code}): ${streamEvent.message}`
								);
							}

							if (streamEvent.type === 'done') {
								this.onFinish(content);
								set({ status: 'done', content });
								receivedDoneEvent = true;
								break;
							}

							if (streamEvent.content) {
								content += streamEvent.content;
								set({ status: 'streaming', content });
							}
						}
					}
				} catch (error) {
					if (error instanceof Error && error.name === 'AbortError') {
						set({ status: 'aborted', content });
						return;
					}

					set({
						status: 'error',
						content,
						message: error instanceof Error ? error.message : String(error)
					});
				}
			})();
		});
	}

	protected onFinish(content: string): void {}

	stop() {
		this.controller.abort();
	}

	subscribe(run: Subscriber<TextStreamState>): Unsubscriber {
		return this.data.subscribe(run);
	}
}

export class CorrectStream extends RedisTextStream {
	constructor({ chatId, messageId }: { chatId: number; messageId: number }) {
		const url = '/api/stream/correct';
		super({ url, chatId, messageId });
	}

	protected onFinish(content: string): void {
		let parsed: unknown;

		try {
			parsed = JSON.parse(content);
		} catch {
			throw new Error(`Invalid JSON response from LLM: ${content}`);
		}

		const result = messageCorrectionResponseSchema.safeParse(parsed);
		if (!result.success) {
			throw new Error(`LLM response does not match correction schema: ${content}`);
		}
	}
}

export class ReplyStream extends RedisTextStream {
	constructor({ chatId, messageId }: { chatId: number; messageId: number }) {
		const url = '/api/stream/reply';
		super({ url, chatId, messageId });
	}
}

abstract class TextStreamManager<TStream extends RedisTextStream> {
	private streamMap = new Map<number, TStream>();
	private unsubscriberMap = new Map<number, Unsubscriber>();
	private valueMap = writable(new Map<number, TextStreamState>());

	protected abstract createStream(input: { chatId: number; messageId: number }): TStream;

	start(input: { chatId: number; messageId: number }) {
		const { messageId } = input;
		if (this.streamMap.has(messageId)) return;

		const stream = this.createStream(input);
		this.streamMap.set(messageId, stream);

		const unsubscriber = stream.subscribe((value) => {
			this.valueMap.update((valueMap) => {
				valueMap.set(messageId, value);
				return valueMap;
			});
		});

		this.unsubscriberMap.set(messageId, unsubscriber);
	}

	stop(input: { chatId: number; messageId: number }) {
		const { messageId } = input;
		const stream = this.streamMap.get(messageId);
		const unsubscriber = this.unsubscriberMap.get(messageId);
		if (!stream || !unsubscriber) return;

		stream.stop();
		unsubscriber();

		this.streamMap.delete(messageId);
		this.unsubscriberMap.delete(messageId);
		this.valueMap.update((valueMap) => {
			valueMap.delete(messageId);
			return valueMap;
		});
	}

	subscribe(run: Subscriber<Map<number, TextStreamState>>): Unsubscriber {
		return this.valueMap.subscribe(run);
	}
}

export class ReplyStreamManager extends TextStreamManager<ReplyStream> {
	protected createStream(input: { chatId: number; messageId: number }): ReplyStream {
		return new ReplyStream(input);
	}
}

export class CorrectStreamManager extends TextStreamManager<CorrectStream> {
	protected createStream(input: { chatId: number; messageId: number }): CorrectStream {
		return new CorrectStream(input);
	}
}
