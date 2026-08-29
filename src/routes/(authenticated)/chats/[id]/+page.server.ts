import type { Actions, PageServerLoad } from './$types';
import * as schema from '$lib/server/db/schema';
import { db } from '$lib/server/db';
import { and, asc, eq } from 'drizzle-orm';
import { redirect } from '@sveltejs/kit';
import z from 'zod';
import { requireUserSession } from '$lib/server/session-user';
import { processConversationTurn, retryCorrection, retryReply } from '$lib/server/chat-turn';
import { normalizeText } from '$lib/correction/normalize-text';
import { buildBlame } from '$lib/correction/build-blame';
import { traceRewriteHistory, type Segment } from '$lib/correction/segments';
import { createFormResponders } from '$lib/forms/result.server';
import {
	REPLY_AND_CORRECT_ID,
	replyAndCorrectFailure,
	replyAndCorrectSuccess
} from '$lib/forms/reply-and-correct';
import { RETRY_REPLY_ID, retryReplyFailure, retryReplySuccess } from '$lib/forms/retry-reply';
import {
	RETRY_CORRECTION_ID,
	retryCorrectionFailure,
	retryCorrectionSuccess
} from '$lib/forms/retry-correction';
import { parseExercisePayload } from '$lib/exercise/parse-exercise';
import { paramsSchema } from './lib/params';

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

const replyAndCorrectResponders = createFormResponders({
	id: REPLY_AND_CORRECT_ID,
	success: replyAndCorrectSuccess,
	failure: replyAndCorrectFailure
});

const retryReplyResponders = createFormResponders({
	id: RETRY_REPLY_ID,
	success: retryReplySuccess,
	failure: retryReplyFailure
});

const retryCorrectionResponders = createFormResponders({
	id: RETRY_CORRECTION_ID,
	success: retryCorrectionSuccess,
	failure: retryCorrectionFailure
});

export const load: PageServerLoad = async ({ params, locals }) => {
	const signedInUser = requireUserSession(locals);
	if (!signedInUser) return redirect(302, '/login');

	const paramsParse = paramsSchema.safeParse(params);
	if (!paramsParse.success) return redirect(302, '/chats');
	const { id: chatId } = paramsParse.data;

	const chat = (
		await db
			.select({ id: schema.chat.id, targetLanguage: schema.chat.targetLanguage })
			.from(schema.chat)
			.where(
				and(
					eq(schema.chat.id, chatId),
					eq(schema.chat.userId, signedInUser.id),
					eq(schema.chat.kind, 'conversation')
				)
			)
	).at(0);

	if (!chat) {
		return redirect(302, '/chats');
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
				.where(eq(schema.message.chatId, chat.id))
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

	const exercises = (
		await db
			.select({
				id: schema.exercise.id,
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
	).map(({ id, payload }) => ({ id, ...parseExercisePayload(payload) }));

	return { messages, exercises };
};

export const actions = {
	replyAndCorrect: async ({ request, locals, params }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(303, '/chats');

		const paramsParse = paramsSchema.safeParse(params);
		if (!paramsParse.success) {
			return replyAndCorrectResponders.fail({ error: { code: 'chat_not_found' }, status: 400 });
		}
		const { id: chatId } = paramsParse.data;

		const formData = await request.formData();
		const formDataParse = z
			.object({
				content: z
					.string()
					.trim()
					.min(1)
					.transform((content) => normalizeText(content))
			})
			.safeParse({ content: formData.get('content')?.toString() ?? '' });

		if (!formDataParse.success)
			return replyAndCorrectResponders.fail({ error: { code: 'invalid_input' }, status: 400 });

		const chat = (
			await db
				.select({ id: schema.chat.id })
				.from(schema.chat)
				.where(and(eq(schema.chat.id, chatId), eq(schema.chat.userId, signedInUser.id)))
		).at(0);

		if (!chat)
			return replyAndCorrectResponders.fail({ error: { code: 'chat_not_found' }, status: 400 });

		const newMessages = await db
			.insert(schema.message)
			.values([
				{ chatId: chat.id, content: formDataParse.data.content, role: 'user', status: 'pending' },
				{ chatId: chat.id, content: '', role: 'assistant', status: 'pending' }
			])
			.returning({ id: schema.message.id });

		const newUserMessage = newMessages.at(0);
		const newAssistantMessage = newMessages.at(1);

		if (!newUserMessage || !newAssistantMessage) {
			throw new Error('Failed to create messages');
		}

		try {
			await processConversationTurn({
				userId: signedInUser.id,
				chatId: chat.id,
				userMessageId: newUserMessage.id,
				assistantMessageId: newAssistantMessage.id
			});
		} catch (error) {
			console.error(error);
			return replyAndCorrectResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return replyAndCorrectResponders.ok({ data: null });
	},
	retryReply: async ({ request, locals, params }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(303, '/chats');

		const paramsParse = paramsSchema.safeParse(params);
		if (!paramsParse.success) {
			return retryReplyResponders.fail({ error: { code: 'invalid_input' }, status: 400 });
		}
		const { id: chatId } = paramsParse.data;

		const formData = await request.formData();
		const formDataParse = z
			.object({ messageId: z.number().positive() })
			.safeParse({ messageId: parseInt(formData.get('message_id')?.toString() ?? '-1') });

		if (!formDataParse.success)
			return retryReplyResponders.fail({ error: { code: 'invalid_input' }, status: 400 });

		try {
			await retryReply({
				userId: signedInUser.id,
				chatId,
				assistantMessageId: formDataParse.data.messageId
			});
		} catch (error) {
			console.error(error);
			return retryReplyResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return retryReplyResponders.ok({ data: null });
	},
	retryCorrection: async ({ request, locals, params }) => {
		const signedInUser = requireUserSession(locals);
		if (!signedInUser) return redirect(303, '/chats');

		const paramsParse = paramsSchema.safeParse(params);
		if (!paramsParse.success) {
			return retryCorrectionResponders.fail({ error: { code: 'invalid_input' }, status: 400 });
		}
		const { id: chatId } = paramsParse.data;

		const formData = await request.formData();
		const formDataParse = z
			.object({ messageId: z.number().positive() })
			.safeParse({ messageId: parseInt(formData.get('message_id')?.toString() ?? '-1') });

		if (!formDataParse.success) {
			return retryCorrectionResponders.fail({
				error: { code: 'invalid_input' },
				status: 400
			});
		}

		try {
			await retryCorrection({
				userId: signedInUser.id,
				chatId,
				userMessageId: formDataParse.data.messageId
			});
		} catch (error) {
			console.error(error);
			return retryCorrectionResponders.fail({ error: { code: 'unexpected' }, status: 500 });
		}

		return retryCorrectionResponders.ok({ data: null });
	}
} satisfies Actions;
