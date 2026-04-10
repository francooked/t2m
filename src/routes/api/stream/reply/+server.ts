import { groq } from '$lib/server/groq';
import z from 'zod';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { and, eq } from 'drizzle-orm';
import { createClient } from 'redis';
import { REDIS_URL } from '$env/static/private';
import { ndjson } from '$lib/utils';

export type StreamEvent =
	| { type: 'chunk'; content: string }
	| {
			type: 'error';
			code: 'timeout' | 'invalid_stream_format' | 'stream_read_failed';
			message: string;
	  }
	| { type: 'done' };

function streamEventChunk({
	content
}: Omit<Extract<StreamEvent, { type: 'chunk' }>, 'type'>): Extract<StreamEvent, { type: 'chunk' }> {
	return { type: 'chunk', content };
}

function streamEventError({
	code,
	message
}: Omit<Extract<StreamEvent, { type: 'error' }>, 'type'>): Extract<StreamEvent, { type: 'error' }> {
	return { type: 'error', code, message };
}

function streamEventDone(): Extract<StreamEvent, { type: 'done' }> {
	return { type: 'done' };
}

const bodySchema = z.object({
	chatId: z.number().positive(),
	messageId: z.number().positive()
});

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

export const POST: RequestHandler = async ({ request, locals }) => {
	const input = await request.json();
	const { success, data } = bodySchema.safeParse({
		chatId: parseInt(input.chatId ?? '-1'),
		messageId: parseInt(input.messageId ?? '-1')
	});
	if (!success) return error(400, { message: 'Invalid input.', code: 'invalid_input' });

	const signedInUser = locals.user as typeof authSchema.user.$inferSelect;
	const chats = await db
		.select({ targetLanguage: schema.chat.targetLanguage })
		.from(schema.chat)
		.innerJoin(schema.message, eq(schema.chat.id, schema.message.chatId))
		.where(
			and(
				eq(schema.chat.id, data.chatId),
				eq(schema.chat.userId, signedInUser.id),
				eq(schema.message.id, data.messageId)
			)
		)
		.limit(1);
	if (chats.length === 0) return error(403, { message: 'Chat not found.', code: 'chat_not_found' });

	const readableStream = new ReadableStream({
		async start(controller) {
			const redisClient = await createClient({ url: REDIS_URL }).connect();
			let lastId = '0-0';
			let ended = false;
			while (!ended) {
				let streams: unknown;

				try {
					streams = await redisClient.xRead(
						{ id: lastId, key: `reply:${data.messageId}` },
						{ BLOCK: 8192, COUNT: 8 }
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

	return new Response(readableStream, {
		headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' }
	});
};
