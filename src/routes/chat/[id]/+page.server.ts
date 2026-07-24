import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import { fail, redirect } from '@sveltejs/kit';
import z from 'zod';
import { requireUserSession } from '$lib/server/session-user';
import { ChatTurnError, processChatTurn, retryCorrection, retryReply } from '$lib/server/chat-turn';
import { normalizeText } from '$lib/correction/normalize-text';
import { buildBlame } from '$lib/correction/build-blame';
import { traceRewriteHistory, type Segment } from '$lib/correction/segments';
import {
	narrowExercisePayload,
	type SelectFnMap
} from '$lib/server/exercise/narrow-exercise-payload';

type BaseMessage = {
	id: number;
	content: string;
	status: 'pending' | 'generating' | 'correcting' | 'complete' | 'failed';
};

type AssistantMessage = BaseMessage & {
	role: 'assistant';
	rewriteHistory?: never;
};

type UserMessage = BaseMessage & {
	role: 'user';
	rewriteHistory: Segment[];
};

type ChatMessage = AssistantMessage | UserMessage;

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const chat = (
		await db
			.select({ id: schema.chat.id, targetLanguage: schema.chat.targetLanguage })
			.from(schema.chat)
			.where(and(eq(schema.chat.id, parseInt(params.id)), eq(schema.chat.userId, signedInUser.id)))
	).at(0);

	if (!chat) {
		return redirect(302, '/chat');
	}

	const messages: ChatMessage[] = Array.from(
		Map.groupBy(
			await db
				.select({
					id: schema.message.id,
					role: schema.message.role,
					content: schema.message.content,
					status: schema.message.status,
					messageRewrite: {
						text: schema.messageRewrite.text,
						reason: schema.messageRewrite.reason,
						index: schema.messageRewrite.index
					}
				})
				.from(schema.message)
				.leftJoin(schema.messageRewrite, eq(schema.message.id, schema.messageRewrite.messageId))
				.where(eq(schema.message.chatId, Number(params.id)))
				.orderBy(schema.message.id),
			({ id }) => id
		)
	).map(([id, records]) => {
		const firstRecord = records.at(0);

		// This should never happen, but just in case, throw an error.
		if (!firstRecord) throw new Error('No record found');

		if (firstRecord.role === 'assistant') {
			return {
				id: firstRecord.id,
				role: firstRecord.role,
				content: firstRecord.content,
				status: firstRecord.status
			};
		}

		const rewrites = records
			.reduce((accumulator, { messageRewrite }) => {
				if (messageRewrite === null) return accumulator;
				accumulator.push({
					index: messageRewrite.index,
					reason: messageRewrite.reason,
					sentence: messageRewrite.text
				});
				return accumulator;
			}, new Array<{ index: number; reason: string; sentence: string }>())
			.toSorted((a, b) => a.index - b.index);

		const cells = buildBlame(firstRecord.content, rewrites, chat.targetLanguage);
		const rewriteHistory = traceRewriteHistory(cells, rewrites);

		return {
			id: firstRecord.id,
			role: firstRecord.role,
			content: firstRecord.content,
			status: firstRecord.status,
			rewriteHistory
		};
	});

	const selectFn = {
		full_answer: {
			1: ({ front, back, extra }) => ({ front, back, extra })
		}
	} satisfies SelectFnMap;

	const exercises = (
		await db
			.select({
				id: schema.exercise.id,
				type: schema.exercise.type,
				version: schema.exercise.version,
				payload: schema.exercise.payload
			})
			.from(schema.exerciseMessageRewrite)
			.innerJoin(
				schema.messageRewrite,
				eq(schema.exerciseMessageRewrite.messageRewriteId, schema.messageRewrite.id)
			)
			.innerJoin(schema.exercise, eq(schema.exerciseMessageRewrite.exerciseId, schema.exercise.id))
			.innerJoin(schema.message, eq(schema.messageRewrite.messageId, schema.message.id))
			.innerJoin(schema.chat, eq(schema.message.chatId, schema.chat.id))
			.where(eq(schema.chat.id, chat.id))
			.orderBy(asc(schema.exercise.id))
	).map((row) => narrowExercisePayload(row, selectFn));

	return { messages, exercises };
};

export const actions = {
	replyAndCorrect: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/chat');

		const formData = await request.formData();
		const zodSchema = z.object({
			chatId: z.number().positive(),
			content: z
				.string()
				.trim()
				.min(1)
				.transform((content) => normalizeText(content))
		});
		const { success, data } = zodSchema.safeParse({
			chatId: parseInt(formData.get('chat_id')?.toString() ?? '-1'),
			content: formData.get('content')?.toString() ?? ''
		});

		if (!success) return fail(400, { code: 'invalid_input' });

		const chat = (
			await db
				.select({ id: schema.chat.id })
				.from(schema.chat)
				.where(and(eq(schema.chat.id, data.chatId), eq(schema.chat.userId, signedInUser.id)))
		).at(0);

		if (!chat) return fail(400, { code: 'chat_not_found' });

		const newMessages = await db
			.insert(schema.message)
			.values([
				{ chatId: data.chatId, content: data.content, role: 'user', status: 'pending' },
				{ chatId: data.chatId, content: '', role: 'assistant', status: 'pending' }
			])
			.returning({ id: schema.message.id });

		const newUserMessage = newMessages.at(0);
		const newAssistantMessage = newMessages.at(1);

		if (!newUserMessage || !newAssistantMessage) {
			return fail(500, { code: 'failed_to_create_messages' });
		}

		try {
			await processChatTurn({
				userId: signedInUser.id,
				chatId: data.chatId,
				userMessageId: newUserMessage.id,
				assistantMessageId: newAssistantMessage.id
			});
		} catch (error) {
			if (error instanceof ChatTurnError) return fail(400, { code: error.code });
			throw error;
		}
	},
	retryReply: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/chat');

		const formData = await request.formData();
		const zodSchema = z.object({ chatId: z.number().positive(), messageId: z.number().positive() });
		const { success, data } = zodSchema.safeParse({
			chatId: parseInt(formData.get('chat_id')?.toString() ?? '-1'),
			messageId: parseInt(formData.get('message_id')?.toString() ?? '-1')
		});

		if (!success) return fail(400, { code: 'invalid_input' });

		try {
			await retryReply({
				userId: signedInUser.id,
				chatId: data.chatId,
				assistantMessageId: data.messageId
			});
		} catch (error) {
			if (error instanceof ChatTurnError) return fail(400, { code: error.code });
			throw error;
		}
	},
	retryCorrection: async ({ request, locals }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(302, '/chat');

		const formData = await request.formData();
		const zodSchema = z.object({ chatId: z.number().positive(), messageId: z.number().positive() });
		const { success, data } = zodSchema.safeParse({
			chatId: parseInt(formData.get('chat_id')?.toString() ?? '-1'),
			messageId: parseInt(formData.get('message_id')?.toString() ?? '-1')
		});

		if (!success) return fail(400, { code: 'invalid_input' });

		try {
			await retryCorrection({
				userId: signedInUser.id,
				chatId: data.chatId,
				userMessageId: data.messageId
			});
		} catch (error) {
			if (error instanceof ChatTurnError) return fail(400, { code: error.code });
			throw error;
		}
	}
} satisfies Actions;
