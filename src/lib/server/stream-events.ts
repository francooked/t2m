export type StreamEvent =
	| { type: 'chunk'; content: string }
	| {
			type: 'error';
			code: 'timeout' | 'invalid_stream_format' | 'stream_read_failed';
			message: string;
	  }
	| { type: 'done' };

export function streamEventChunk({
	content
}: Omit<Extract<StreamEvent, { type: 'chunk' }>, 'type'>): Extract<StreamEvent, { type: 'chunk' }> {
	return { type: 'chunk', content };
}

export function streamEventError({
	code,
	message
}: Omit<Extract<StreamEvent, { type: 'error' }>, 'type'>): Extract<StreamEvent, { type: 'error' }> {
	return { type: 'error', code, message };
}

export function streamEventDone(): Extract<StreamEvent, { type: 'done' }> {
	return { type: 'done' };
}
