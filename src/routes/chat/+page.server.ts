import { db } from '$lib/server/db';
import type { PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import { and, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import z from 'zod';
import { LANGUAGE_CODES } from '$lib/constants';
import { requireUserSession } from '$lib/server/session-user';
import { processChatTurn } from '$lib/server/chat-turn';
import { normalizeText } from '$lib/correction/normalize-text';

export const load: PageServerLoad = async ({ locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const userProfile = (
		await db
			.select({ nativeLanguage: schema.userProfile.nativeLanguage })
			.from(schema.userProfile)
			.where(eq(schema.userProfile.userId, signedInUser.id))
			.limit(1)
	).at(0);

	if (!userProfile) return redirect(302, '/login');

	const chats = await db
		.select({ id: schema.chat.id, title: schema.chat.title })
		.from(schema.chat)
		.where(eq(schema.chat.userId, signedInUser.id));

	return { chats, userProfile };
};

export const actions = {
	startChat: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/login');

		const userProfile = (
			await db
				.select({ nativeLanguage: schema.userProfile.nativeLanguage })
				.from(schema.userProfile)
				.where(eq(schema.userProfile.userId, signedInUser.id))
				.limit(1)
		).at(0);

		if (!userProfile) return redirect(302, '/login');

		const formData = await request.formData();
		const zodSchema = z.object({
			content: z
				.string()
				.trim()
				.min(1)
				.transform((content) => normalizeText(content)),
			targetLanguage: z.enum(LANGUAGE_CODES).refine((code) => code !== userProfile.nativeLanguage, {
				error: 'You cannot chat in your native language'
			})
		});
		const { success, data } = zodSchema.safeParse({
			content: formData.get('content')?.toString() ?? '',
			targetLanguage: formData.get('target_language')?.toString() ?? ''
		});

		if (!success) return fail(400, { code: 'invalid_input' });

		const { newChat, newUserMessage, newAssistantMessage } = await db.transaction(async (tx) => {
			const newChat = (
				await tx
					.insert(schema.chat)
					.values({
						targetLanguage: data.targetLanguage,
						title: 'Nueva conversación',
						userId: signedInUser.id
					})
					.returning({ id: schema.chat.id })
			).at(0);

			if (!newChat) {
				throw new Error('Failed to create new chat.');
			}

			const newMessages = await tx
				.insert(schema.message)
				.values([
					{ chatId: newChat.id, content: data.content, role: 'user', status: 'pending' },
					{ chatId: newChat.id, content: '', role: 'assistant', status: 'pending' }
				])
				.returning({ id: schema.message.id });

			const newUserMessage = newMessages.at(0);
			const newAssistantMessage = newMessages.at(1);

			if (!newUserMessage || !newAssistantMessage) {
				throw new Error('Failed to create new messages.');
			}

			return { newChat, newUserMessage, newAssistantMessage };
		});

		await processChatTurn({
			userId: signedInUser.id,
			chatId: newChat.id,
			userMessageId: newUserMessage.id,
			assistantMessageId: newAssistantMessage.id
		});

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
