import { prompts as correctionPrompts } from '$lib/prompts/message-rewrite';
import { prompts as replyPrompts } from '$lib/prompts/conversation-reply';
import { Worker } from 'bullmq';
import Groq from 'groq-sdk';
import { createClient } from 'redis';
import * as schema from '$lib/server/db/schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { eq, and, lt, lte, desc } from 'drizzle-orm';
import process from 'node:process';
import { correctionQueue, replyQueue } from './lib/server/db/queues';
import z from 'zod';

export const replyWorker = new Worker<{ messageId: number; chatId: number }, void>(
	replyQueue.name,
	async ({ data: { chatId, messageId } }) => {
		if (!process.env.GROQ_API_KEY) {
			console.log('Undefined GROQ_API_KEY environment variable.');
			return;
		}
		if (!process.env.DATABASE_URL) {
			console.log('Undefined DATABASE_URL environment variable.');
			return;
		}

		const redisClient = await createClient({ url: process.env.REDIS_URL }).connect();
		const groqClient = new Groq({ apiKey: process.env.GROQ_API_KEY });
		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });

		const chat = (
			await db
				.select({
					nativeLanguage: schema.userProfile.nativeLanguage,
					targetLanguage: schema.chat.targetLanguage
				})
				.from(schema.message)
				.innerJoin(schema.chat, eq(schema.message.chatId, schema.chat.id))
				.innerJoin(schema.userProfile, eq(schema.chat.userId, schema.userProfile.userId))
				.where(and(eq(schema.message.id, messageId), eq(schema.chat.id, chatId)))
				.limit(1)
		).at(0);

		if (!chat) {
			throw new Error('Chat not found.');
		}

		const messages = await db
			.select({
				content: schema.message.content,
				role: schema.message.role
			})
			.from(schema.message)
			.innerJoin(schema.chat, eq(schema.message.chatId, schema.chat.id))
			.where(and(lt(schema.message.id, messageId), eq(schema.chat.id, chatId)));

		const groqStream = await groqClient.chat.completions.create({
			messages: replyPrompts(
				messages.map(({ role, content }) => ({ role, content })),
				{
					nativeLanguage: chat.nativeLanguage,
					targetLanguage: chat.targetLanguage
				}
			),
			model: 'openai/gpt-oss-20b',
			temperature: 0.5,
			max_completion_tokens: 4096,
			top_p: 1,
			stop: null,
			stream: true
		});

		let fullContent: string = '';
		for await (const chunk of groqStream) {
			const chunkContent = chunk.choices[0]?.delta?.content || '';
			redisClient.xAdd(`reply:${messageId}`, '*', { content: chunkContent, done: 'false' });
			fullContent += chunkContent;
		}
		redisClient.xAdd(`reply:${messageId}`, '*', { content: '', done: 'true' });

		await db
			.update(schema.message)
			.set({ content: fullContent })
			.where(eq(schema.message.id, messageId));

		console.log('(reply) job.data:', { chatId, messageId }, 'content:', fullContent);
	},
	{
		connection: { url: process.env.REDIS_URL }
	}
)
	.on('progress', async ({ data: { chatId, messageId } }) => {
		if (!process.env.DATABASE_URL) {
			console.log('Undefined DATABASE_URL environment variable.');
			return;
		}

		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });
		await db
			.update(schema.message)
			.set({ status: 'generating' })
			.where(and(eq(schema.message.id, messageId), eq(schema.message.chatId, chatId)));
	})
	.on('completed', async ({ data: { chatId, messageId } }) => {
		if (!process.env.DATABASE_URL) {
			console.log('Undefined DATABASE_URL environment variable.');
			return;
		}

		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });
		await db
			.update(schema.message)
			.set({ status: 'complete' })
			.where(and(eq(schema.message.id, messageId), eq(schema.message.chatId, chatId)));
	})
	.on('failed', async (job, error) => {
		if (!job) {
			console.log('(reply) Worker failed:', error);
			return;
		}

		console.log('(reply) Worker failed:', error);

		if (!process.env.DATABASE_URL) {
			console.log('Undefined DATABASE_URL environment variable.');
			return;
		}

		const {
			data: { chatId, messageId }
		} = job;

		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });
		await db
			.update(schema.message)
			.set({ status: 'failed' })
			.where(and(eq(schema.message.id, messageId), eq(schema.message.chatId, chatId)));
	});

export const correctionWorker = new Worker<{ messageId: number; chatId: number }, void>(
	correctionQueue.name,
	async ({ data: { chatId, messageId } }) => {
		if (!process.env.GROQ_API_KEY) {
			throw new Error('Undefined GROQ_API_KEY environment variable.');
		}
		if (!process.env.DATABASE_URL) {
			throw new Error('Undefined DATABASE_URL environment variable.');
		}

		const redisClient = await createClient({ url: process.env.REDIS_URL }).connect();
		const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });

		const chat = (
			await db
				.select({
					userId: schema.userProfile.userId,
					nativeLanguage: schema.userProfile.nativeLanguage,
					targetLanguage: schema.chat.targetLanguage
				})
				.from(schema.chat)
				.innerJoin(schema.message, eq(schema.chat.id, schema.message.chatId))
				.innerJoin(schema.userProfile, eq(schema.chat.userId, schema.userProfile.userId))
				.where(and(eq(schema.chat.id, chatId), eq(schema.message.id, messageId)))
				.limit(1)
		).at(0);

		if (!chat) {
			throw new Error('Chat not found.');
		}

		const messages = await db
			.select({
				role: schema.message.role,
				content: schema.message.content
			})
			.from(schema.message)
			.where(and(lte(schema.message.id, messageId), eq(schema.message.chatId, chatId)))
			.orderBy(desc(schema.message.id))
			.limit(4);
		messages.reverse();

		const lastMessage = messages.at(-1);
		if (!lastMessage || lastMessage.role !== 'user')
			throw new Error('Last message not found or is not a user message.');

		const groqStream = await groq.chat.completions.create({
			messages: correctionPrompts(
				messages.map(({ role, content }) => ({ role, content })),
				{
					nativeLanguage: chat.nativeLanguage,
					targetLanguage: chat.targetLanguage
				}
			),
			model: 'openai/gpt-oss-20b',
			temperature: 0.5,
			max_completion_tokens: 4096,
			top_p: 1,
			stop: null,
			stream: true
		});

		let fullContent: string = '';
		for await (const chunk of groqStream) {
			const chunkContent = chunk.choices[0]?.delta?.content || '';
			redisClient.xAdd(`correct:${messageId}`, '*', { content: chunkContent, done: 'false' });
			fullContent += chunkContent;
		}
		redisClient.xAdd(`correct:${messageId}`, '*', { content: '', done: 'true' });

		const zodSchema = z.object({
			translation: z.string().min(1),
			corrections: z.array(
				z.object({
					fragment: z.string().min(1),
					reason: z.string().min(1),
					suggestions: z.array(z.object({ replacement: z.string().min(1) }))
				})
			)
		});
		const { success, data } = zodSchema.safeParse(JSON.parse(fullContent));
		if (!success) {
			throw new Error('Invalid JSON response from LLM.');
		}

		if (data.corrections.length > 0) {
			const { corrections, suggestions } = await db.transaction(async (tx) => {
				const corrections = await tx
					.insert(schema.correction)
					.values(
						data.corrections.map(({ fragment, reason }) => {
							const start = lastMessage.content.indexOf(fragment);
							const end = start + fragment.length - 1;
							return {
								messageId,
								reason,
								start,
								end
							};
						})
					)
					.returning({ id: schema.correction.id });

				const suggestions = await tx
					.insert(schema.suggestion)
					.values(
						data.corrections.flatMap(({ suggestions }, index) => {
							return suggestions.map(({ replacement }) => ({
								correctionId: corrections[index].id,
								replacement
							}));
						})
					)
					.returning({ id: schema.suggestion.id });

				const front = lastMessage.content;
				const back = data.corrections.reduce(
					(acc, { fragment, suggestions }) => acc.replace(fragment, suggestions[0].replacement),
					lastMessage.content
				);
				const extra = data.translation;
				const exercises = await tx
					.insert(schema.exercise)
					.values({
						userId: chats[0].userId,
						targetLanguage: chats[0].targetLanguage,
						type: 'full_answer',
						version: 1,
						source: { type: 'correction', correctionIds: corrections.map(({ id }) => id) },
						payload: { front, back, extra }
					})
					.returning({ id: schema.exercise.id });

				return { corrections, suggestions, exercises };
			});
		}

		console.log('(correct) job.data:', { chatId, messageId }, 'correction:', JSON.stringify(data));
	},
	{
		connection: { url: process.env.REDIS_URL }
	}
)
	.on('progress', async ({ data: { chatId, messageId } }) => {
		if (!process.env.DATABASE_URL) {
			throw new Error('Undefined DATABASE_URL environment variable.');
		}

		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });
		await db
			.update(schema.message)
			.set({ status: 'correcting' })
			.where(and(eq(schema.message.id, messageId), eq(schema.message.chatId, chatId)));
	})
	.on('completed', async ({ data: { chatId, messageId } }) => {
		if (!process.env.DATABASE_URL) {
			throw new Error('Undefined DATABASE_URL environment variable.');
		}

		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });
		await db
			.update(schema.message)
			.set({ status: 'complete' })
			.where(and(eq(schema.message.id, messageId), eq(schema.message.chatId, chatId)));
	})
	.on('failed', async (job, error) => {
		if (!job) {
			console.log('(correct) Worker failed:', error);
			return;
		}

		console.log('(correct) Worker failed:', error);

		if (!process.env.DATABASE_URL) {
			console.log('Undefined DATABASE_URL environment variable.');
			return;
		}

		const {
			data: { chatId, messageId }
		} = job;

		const pgClient = postgres(process.env.DATABASE_URL);
		const db = drizzle(pgClient, { schema: { ...schema, ...authSchema } });
		await db
			.update(schema.message)
			.set({ status: 'failed' })
			.where(and(eq(schema.message.id, messageId), eq(schema.message.chatId, chatId)));
	});
