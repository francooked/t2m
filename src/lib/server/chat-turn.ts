import * as schema from '$lib/server/db/schema';
import * as z from 'zod';
import { db } from '$lib/server/db';
import { eq, and } from 'drizzle-orm';
import Groq from 'groq-sdk';
import { GROQ_API_KEY } from '$env/static/private';
import {
	messageReplyResponseSchema,
	prompts as replyPrompts
} from '$lib/prompts/conversation-reply';
import {
	buildPrompt as buildMessageCorrectionPrompt,
	outputSchema as messageCorrectionOutputSchema
} from '$lib/prompts/message-correction';

const groqClient = new Groq({ apiKey: GROQ_API_KEY });

export class ChatTurnError extends Error {
	constructor(
		public code: 'chat_not_found' | 'messages_not_found' | 'llm_invalid_response' | 'persist_failed'
	) {
		super(code);
	}
}

async function parseLlmResponse<T extends z.ZodType>(content: any, schema: T) {
	try {
		const json = JSON.parse(content);
		const parsed = schema.parse(json);
		return parsed;
	} catch (error) {
		console.log('error:', error);
		throw new ChatTurnError('llm_invalid_response');
	}
}

async function updateMessageStatus({
	chatId,
	messageId,
	status
}: {
	chatId: number;
	messageId: number;
	status: typeof schema.message.$inferInsert.status;
}) {
	await db
		.update(schema.message)
		.set({ status })
		.where(and(eq(schema.message.chatId, chatId), eq(schema.message.id, messageId)));
}

async function loadChat({ userId, chatId }: { userId: string; chatId: number }) {
	const chat = (
		await db
			.select({
				id: schema.chat.id,
				userId: schema.userProfile.userId,
				nativeLanguage: schema.userProfile.nativeLanguage,
				targetLanguage: schema.chat.targetLanguage
			})
			.from(schema.chat)
			.innerJoin(schema.message, eq(schema.chat.id, schema.message.chatId))
			.innerJoin(schema.userProfile, eq(schema.chat.userId, schema.userProfile.userId))
			.where(and(eq(schema.chat.userId, userId), eq(schema.chat.id, chatId)))
			.limit(1)
	).at(0);

	if (!chat) throw new ChatTurnError('chat_not_found');

	const messages = await db
		.select({
			id: schema.message.id,
			content: schema.message.content,
			role: schema.message.role,
			status: schema.message.status
		})
		.from(schema.message)
		.innerJoin(schema.chat, eq(schema.message.chatId, schema.chat.id))
		.where(and(eq(schema.chat.userId, userId), eq(schema.chat.id, chatId)));

	// Even if the chat is new, there should be at least two messages: one user message and one assistant message.
	// They are both pending.
	if (messages.length < 2) {
		throw new ChatTurnError('messages_not_found');
	}

	return { chat, messages };
}

async function replyUserMessage({
	chat,
	messages,
	userMessageId,
	assistantMessageId
}: { userMessageId: number; assistantMessageId: number } & Awaited<ReturnType<typeof loadChat>>) {
	const userMessage = messages.find(
		(message) =>
			message.id === userMessageId && message.role === 'user' && message.status === 'pending'
	);

	const assistantMessage = messages.find(
		(message) => message.id === assistantMessageId && message.role === 'assistant'
	);

	if (!userMessage || !assistantMessage) {
		throw new ChatTurnError('messages_not_found');
	}

	await updateMessageStatus({
		chatId: chat.id,
		messageId: assistantMessage.id,
		status: 'generating'
	});

	const chatCompletion = await groqClient.chat.completions.create({
		messages: replyPrompts(
			messages
				.filter((message) => message.id <= userMessage.id)
				.map(({ role, content }) => ({ role, content })),
			{
				nativeLanguage: chat.nativeLanguage,
				targetLanguage: chat.targetLanguage
			}
		),
		model: 'openai/gpt-oss-20b',
		temperature: 0.5,
		max_completion_tokens: 4096,
		top_p: 1,
		stop: null
	});

	const reply = await parseLlmResponse(
		chatCompletion.choices.at(0)?.message.content,
		messageReplyResponseSchema
	);

	await db
		.update(schema.message)
		.set({ content: reply.answer, status: 'complete' })
		.where(and(eq(schema.message.chatId, chat.id), eq(schema.message.id, assistantMessage.id)));
}

async function correctUserMessage({
	chat,
	messages,
	userMessageId,
	assistantMessageId
}: { userMessageId: number; assistantMessageId: number } & Awaited<ReturnType<typeof loadChat>>) {
	const userMessage = messages.find(
		(message) =>
			message.id === userMessageId && message.role === 'user' && message.status === 'pending'
	);

	const assistantMessage = messages.find(
		(message) => message.id === assistantMessageId && message.role === 'assistant'
	);

	if (!userMessage || !assistantMessage) {
		throw new ChatTurnError('messages_not_found');
	}

	await updateMessageStatus({
		chatId: chat.id,
		messageId: userMessage.id,
		status: 'correcting'
	});

	const chatCompletion = await groqClient.chat.completions.create({
		messages: buildMessageCorrectionPrompt({
			nativeLanguage: chat.nativeLanguage,
			targetLanguage: chat.targetLanguage,
			turns: messages
				.filter((message) => message.id <= userMessage.id)
				.map(({ role, content }) => ({ role, content }))
		}),
		model: 'openai/gpt-oss-20b',
		temperature: 0.2,
		max_completion_tokens: 4096,
		top_p: 1,
		stop: null
	});

	const llmResponse = await parseLlmResponse(
		chatCompletion.choices.at(0)?.message.content,
		messageCorrectionOutputSchema
	);

	if (llmResponse.steps.length > 0) {
		await db.transaction(async (tx) => {
			const messageRewrites = await tx
				.insert(schema.messageRewrite)
				.values(
					llmResponse.steps.map(({ sentence }, index) => ({
						messageId: userMessageId,
						text: sentence,
						index
					}))
				)
				.returning({ id: schema.messageRewrite.id, text: schema.messageRewrite.text });
			const lastMessageRewrite = messageRewrites.at(-1);

			if (!lastMessageRewrite) throw new ChatTurnError('persist_failed');

			const front = userMessage.content;
			const back = lastMessageRewrite.text;
			const extra = llmResponse.translation;

			const exercise = (
				await tx
					.insert(schema.exercise)
					.values({
						userId: chat.userId,
						targetLanguage: chat.targetLanguage,
						type: 'full_answer',
						version: 1,
						source: { messageRewriteId: lastMessageRewrite.id },
						payload: { front, back, extra }
					})
					.returning({ id: schema.exercise.id })
			).at(0);

			if (!exercise) throw new ChatTurnError('persist_failed');
		});
	}

	console.log('llmResponse', JSON.stringify(llmResponse));

	await updateMessageStatus({
		chatId: chat.id,
		messageId: userMessage.id,
		status: 'complete'
	});
}

export async function processChatTurn({
	userId,
	chatId,
	userMessageId,
	assistantMessageId
}: {
	userId: string;
	chatId: number;
	userMessageId: number;
	assistantMessageId: number;
}) {
	const { chat, messages } = await loadChat({ userId, chatId });
	await Promise.all([
		replyUserMessage({ chat, messages, assistantMessageId, userMessageId }),
		correctUserMessage({ chat, messages, assistantMessageId, userMessageId })
	]);
}
