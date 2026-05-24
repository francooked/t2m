import { ndjson } from '$lib/utils';
import { createClient } from 'redis';
import z from 'zod';
import { streamEventChunk, streamEventDone, streamEventError } from '../stream-events';

const redisStreamSchema = z
	.array(
		z.object({
			name: z.string(),
			messages: z.array(
				z.object({
					id: z.string(),
					message: z.object({
						content: z.string(),
						done: z.enum(['true', 'false']).transform((v) => v === 'true')
					})
				})
			)
		})
	)
	.length(1)
	.nullable();

export function createRedisNdjsonStream({
	redisUrl,
	streamKey,
	blockMs = 32_768,
	count = 8
}: {
	redisUrl: string;
	streamKey: string;
	blockMs: number;
	count: number;
}) {
	return new ReadableStream<string>({
		async start(controller) {
			const redisClient = await createClient({ url: redisUrl }).connect();
			let lastId = '0-0';
			let ended = false;
			while (!ended) {
				let streams: unknown;

				try {
					streams = await redisClient.xRead(
						{ id: lastId, key: streamKey },
						{ BLOCK: blockMs, COUNT: count }
					);
				} catch (error) {
					controller.enqueue(
						ndjson(
							streamEventError({
								code: 'stream_read_failed',
								message: `Stream read failed. Error: ${error}`
							})
						)
					);
					controller.enqueue(ndjson(streamEventDone()));
					break;
				}

				const parsedStreams = redisStreamSchema.safeParse(streams);
				if (!parsedStreams.success) {
					controller.enqueue(
						ndjson(
							streamEventError({
								code: 'invalid_stream_format',
								message: 'Invalid stream payload format.'
							})
						)
					);
					controller.enqueue(ndjson(streamEventDone()));
					break;
				}

				if (!parsedStreams.data) {
					controller.enqueue(
						ndjson(
							streamEventError({
								code: 'timeout',
								message: 'No stream data received in time.'
							})
						)
					);
					controller.enqueue(ndjson(streamEventDone()));
					break;
				}

				for (const { id, message } of parsedStreams.data[0].messages) {
					lastId = id;
					if (message.done) {
						controller.enqueue(ndjson(streamEventDone()));
						ended = true;
						break;
					}
					controller.enqueue(ndjson(streamEventChunk({ content: message.content })));
				}
			}

			controller.close();
			redisClient.destroy();
		}
	});
}
