import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { db } from '$lib/server/db';
import { and, desc, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import z from 'zod';
import { correctionQueue, replyQueue } from '$lib/server/db/queues';
import { createClient } from 'redis';
import { REDIS_URL } from '$env/static/private';

export const load: PageServerLoad = async ({ params, locals }) => {
	// Verify the chat belongs to the signed in user.
	const signedInUser = locals.user as typeof authSchema.user.$inferSelect;
	const chat = await db.$count(
		schema.chat,
		and(eq(schema.chat.id, parseInt(params.id)), eq(schema.chat.userId, signedInUser.id))
	);
	if (chat === 0) return redirect(302, '/chat');

	const messages = await db
		.select({
			id: schema.message.id,
			role: schema.message.role,
			content: schema.message.content,
			status: schema.message.status,
			correction: {
				id: schema.correction.id,
				start: schema.correction.start,
				end: schema.correction.end,
				reason: schema.correction.reason
			},
			suggestion: {
				id: schema.suggestion.id,
				replacement: schema.suggestion.replacement
			}
		})
		.from(schema.message)
		.leftJoin(schema.correction, eq(schema.message.id, schema.correction.messageId))
		.leftJoin(schema.suggestion, eq(schema.correction.id, schema.suggestion.correctionId))
		.where(eq(schema.message.chatId, parseInt(params.id)))
		.orderBy(schema.message.id);

	let map: Record<
		number,
		{
			corrections: Record<
				number,
				{ suggestions: NonNullable<(typeof messages)[number]['suggestion']>[] } & NonNullable<
					(typeof messages)[number]['correction']
				>
			>;
		} & Omit<(typeof messages)[number], 'correction' | 'suggestion'>
	> = {};

	for (let i = 0; i < messages.length; i++) {
		const message = messages[i];
		const correction = messages[i].correction;
		const suggestion = messages[i].suggestion;

		if (!(message.id in map)) {
			map[message.id] = {
				id: message.id,
				role: messages[i].role,
				content: messages[i].content,
				status: messages[i].status,
				corrections: {}
			};
		}

		if (!correction || !suggestion) continue;

		if (!(correction.id in map[message.id].corrections)) {
			map[message.id].corrections[correction.id] = {
				id: correction.id,
				start: correction.start,
				end: correction.end,
				reason: correction.reason,
				suggestions: []
			};
		}

		map[message.id].corrections[correction.id].suggestions.push({
			id: suggestion.id,
			replacement: suggestion.replacement
		});
	}

	return {
		messages: Object.values(map).map(({ corrections, ...rest }) => ({
			...rest,
			corrections: Object.values(corrections)
		}))
	};
};

export const actions = {
	reply: async ({ request, locals }) => {
		const formData = await request.formData();
		const zodSchema = z.object({ chatId: z.number().positive(), content: z.string().min(1) });
		const { success, data } = zodSchema.safeParse({
			chatId: parseInt(formData.get('chatId')?.toString() ?? '-1'),
			content: formData.get('content')?.toString() ?? ''
		});
		if (!success) return fail(400, { code: 'invalid_input' });

		const signedInUser = locals.user as typeof authSchema.user.$inferSelect;
		const chats = await db
			.select({ id: schema.chat.id })
			.from(schema.chat)
			.where(and(eq(schema.chat.id, data.chatId), eq(schema.chat.userId, signedInUser.id)));
		if (chats.length != 1) return fail(400, { code: 'chat_not_found' });

		const newMessages = await db
			.insert(schema.message)
			.values([
				{ chatId: data.chatId, content: data.content, role: 'user', status: 'pending' },
				{ chatId: data.chatId, content: '', role: 'assistant', status: 'pending' }
			])
			.returning({ id: schema.message.id });

		const redisClient = await createClient({ url: REDIS_URL }).connect();
		await Promise.all([
			correctionQueue.add('correct', { messageId: newMessages[0].id, chatId: data.chatId }),
			replyQueue.add('reply', { messageId: newMessages[1].id, chatId: data.chatId })
		]);
		redisClient.destroy();
	}
} satisfies Actions;
