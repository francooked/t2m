import z from 'zod';

export const streamEventSchema = z.xor([
	z.object({ type: z.literal('chunk'), content: z.string() }),
	z.object({
		type: z.literal('error'),
		code: z.enum(['timeout', 'invalid_stream_format', 'stream_read_failed']),
		message: z.string()
	}),
	z.object({ type: z.literal('done') })
]);

export type StreamEvent = z.infer<typeof streamEventSchema>;

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
