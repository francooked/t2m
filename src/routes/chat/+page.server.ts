import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import z from 'zod';
import { LANGUAGES } from '$lib/constants';
import { createClient } from 'redis';
import { REDIS_URL } from '$env/static/private';
import { correctionQueue, replyQueue } from '$lib/server/db/queues';
import { requireUserSession } from '$lib/server/session-user';

export const load: PageServerLoad = async ({ locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const chats = await db
		.select({ id: schema.chat.id, title: schema.chat.title })
		.from(schema.chat)
		.where(eq(schema.chat.userId, signedInUser.id));

	return { chats };
};

export const actions = {
	startChat: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const formData = await request.formData();
		const zodSchema = z.object({ content: z.string().min(1), targetLanguage: z.enum(LANGUAGES) });
		const { success, data } = zodSchema.safeParse({
			content: formData.get('content')?.toString() ?? '',
			targetLanguage: formData.get('target_language')?.toString() ?? ''
		});

		if (!success) return fail(400, { code: 'invalid_input' });

		const redisClient = await createClient({ url: REDIS_URL }).connect();

		const { newChat, newMessages } = await db.transaction(async (tx) => {
			const newChat = (
				await tx
					.insert(schema.chat)
					.values({
						targetLanguage: data.targetLanguage,
						title: 'Nueva conversación',
						userId: signedInUser.id
					})
					.returning({ id: schema.chat.id })
			)[0];

			const newMessages = await tx
				.insert(schema.message)
				.values([
					{ chatId: newChat.id, content: data.content, role: 'user', status: 'pending' },
					{ chatId: newChat.id, content: '', role: 'assistant', status: 'pending' }
				])
				.returning({ id: schema.message.id });

			return { newChat, newMessages };
		});

		await Promise.all([
			correctionQueue.add('correct', { messageId: newMessages[0].id, chatId: newChat.id }),
			replyQueue.add('reply', { messageId: newMessages[1].id, chatId: newChat.id })
		]);

		redisClient.destroy();
		return redirect(303, `/chat/${newChat.id}`);
	},
	deleteChat: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const formData = await request.formData();
		const zodSchema = z.object({ chatId: z.number().positive() });
		const { success, data } = zodSchema.safeParse({
			chatId: parseInt(formData.get('chat_id')?.toString() ?? '-1')
		});
		if (!success) return fail(400, { code: 'invalid_input' });

		await db
			.delete(schema.chat)
			.where(and(eq(schema.chat.id, data.chatId), eq(schema.chat.userId, signedInUser.id)));
	}
} satisfies Actions;
