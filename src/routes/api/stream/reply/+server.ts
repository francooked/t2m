import z from 'zod';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { REDIS_URL } from '$env/static/private';
import { requireUserSession } from '$lib/server/session-user';
import { createRedisNdjsonStream } from '$lib/server/redis-stream-reader';

const bodySchema = z.object({
	chatId: z.number().positive(),
	messageId: z.number().positive()
});

export const POST: RequestHandler = async ({ request, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return error(401, { message: 'Unauthorized.', code: 'unauthorized' });

	const input = await request.json();
	const { success, data } = bodySchema.safeParse({
		chatId: parseInt(input.chatId ?? '-1'),
		messageId: parseInt(input.messageId ?? '-1')
	});
	if (!success) return error(400, { message: 'Invalid input.', code: 'invalid_input' });

	const chat = (
		await db
			.select({ id: schema.chat.id })
			.from(schema.chat)
			.innerJoin(schema.message, eq(schema.chat.id, schema.message.chatId))
			.where(
				and(
					eq(schema.chat.id, data.chatId),
					eq(schema.chat.userId, signedInUser.id),
					eq(schema.message.id, data.messageId)
				)
			)
			.limit(1)
	).at(0);

	if (!chat) return error(403, { message: 'Chat not found.', code: 'chat_not_found' });

	const readableStream = createRedisNdjsonStream({
		redisUrl: REDIS_URL,
		streamKey: `reply:${data.messageId}`,
		blockMs: 32_768,
		count: 8
	});

	return new Response(readableStream, {
		headers: { 'content-type': 'application/x-ndjson', 'cache-control': 'no-cache' }
	});
};
