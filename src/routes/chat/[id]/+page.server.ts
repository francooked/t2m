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
import { requireUserSession } from '$lib/server/session-user';

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const chats = await db
		.select({ id: schema.chat.id })
		.from(schema.chat)
		.where(and(eq(schema.chat.id, parseInt(params.id)), eq(schema.chat.userId, signedInUser.id)));
	if (chats.length !== 1) return redirect(302, '/chat');

	const rows = await db
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
		.orderBy(schema.message.id, schema.correction.id, schema.suggestion.id);

	let messagesMap: Record<
		number,
		{
			corrections: Record<
				number,
				{ suggestions: NonNullable<(typeof rows)[number]['suggestion']>[] } & NonNullable<
					(typeof rows)[number]['correction']
				>
			>;
		} & Omit<(typeof rows)[number], 'correction' | 'suggestion'>
	> = {};

	for (let i = 0; i < rows.length; i++) {
		const row = rows[i];
		const correction = rows[i].correction;
		const suggestion = rows[i].suggestion;

		if (!(row.id in messagesMap)) {
			messagesMap[row.id] = {
				id: row.id,
				role: rows[i].role,
				content: rows[i].content,
				status: rows[i].status,
				corrections: {}
			};
		}

		if (!correction || !suggestion) continue;

		if (!(correction.id in messagesMap[row.id].corrections)) {
			messagesMap[row.id].corrections[correction.id] = {
				id: correction.id,
				start: correction.start,
				end: correction.end,
				reason: correction.reason,
				suggestions: []
			};
		}

		messagesMap[row.id].corrections[correction.id].suggestions.push({
			id: suggestion.id,
			replacement: suggestion.replacement
		});
	}

	return {
		messages: Object.values(messagesMap).map(({ corrections, role, ...rest }) => {
			if (role === 'user') {
				return { role, corrections: Object.values(corrections), ...rest };
			} else {
				return { role, ...rest };
			}
		})
	};
};

export const actions = {
	reply: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/chat');

		const formData = await request.formData();
		const zodSchema = z.object({ chatId: z.number().positive(), content: z.string().min(1) });
		const { success, data } = zodSchema.safeParse({
			chatId: parseInt(formData.get('chat_id')?.toString() ?? '-1'),
			content: formData.get('content')?.toString() ?? ''
		});
		if (!success) return fail(400, { code: 'invalid_input' });

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
