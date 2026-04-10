import z from 'zod';
import type { RequestHandler } from './$types';
import { error } from '@sveltejs/kit';
import { groq } from '$lib/server/groq';
import { prompts } from '$lib/prompts/correction';
import { LANGUAGES } from '$lib/constants';
import { db } from '$lib/server/db';
import * as schema from '$lib/server/db/schema';
import * as authSchema from '$lib/server/db/auth.schema';
import { and, eq } from 'drizzle-orm';

type LlmSuggestion = { replacement: string };
type LlmCorrection = { fragment: string; reason: string; suggestions: LlmSuggestion[] };

export const POST: RequestHandler = async ({ request, locals }) => {
	const formData = await request.formData();
	const zodSchema = z.object({
		messageId: z.number().positive()
	});
	const { success, data } = zodSchema.safeParse({
		messageId: parseInt(formData.get('message_id')?.toString() ?? '-1')
	});
	if (!success) return error(400, { message: 'Invalid input.', code: 'invalid_input' });

	// Obtener nativeLanguage
	const signedInUser = locals.user as typeof authSchema.user.$inferSelect;
	const userProfiles = await db
		.select({ nativeLanguage: schema.userProfile.nativeLanguage })
		.from(schema.userProfile)
		.where(eq(schema.userProfile.userId, signedInUser.id))
		.limit(1);

	// The user doesn't have a profile.
	if (userProfiles.length === 0)
		return error(400, { message: 'User profile required.', code: 'user_profile_required' });

	// Extraer el targetLanguage
	const messages = await db
		.select({ targetLanguage: schema.chat.targetLanguage, content: schema.message.content })
		.from(schema.message)
		.innerJoin(schema.chat, eq(schema.message.chatId, schema.chat.id))
		.where(and(eq(schema.message.id, data.messageId), eq(schema.chat.userId, signedInUser.id)))
		.limit(1);

	if (messages.length === 0) return error(400, { message: 'Empty chat.', code: 'empty_chat' });

	const chatStream = await groq.chat.completions.create({
		messages: prompts(messages[0].content, {
			nativeLanguage: userProfiles[0].nativeLanguage,
			targetLanguage: messages[0].targetLanguage
		}),
		model: 'openai/gpt-oss-20b',
		temperature: 0.5,
		max_completion_tokens: 4096,
		top_p: 1,
		stop: null,
		stream: true
	});

	const readableStream = new ReadableStream({
		async start(controller) {
			let content = '';
			for await (const chunk of chatStream) {
				content += chunk.choices[0]?.delta?.content || '';
				controller.enqueue(chunk.choices[0]?.delta?.content || '');
			}
			controller.close();

			const llmCorrections: LlmCorrection[] = JSON.parse(content);

			for (const llmCorrection of llmCorrections) {
				const startIndex = messages[0].content.indexOf(llmCorrection.fragment);
				if (startIndex === -1) {
					console.log(`The '${llmCorrection.fragment}' fragment does not exist in the sentence.`);
					return;
				}
				const endIndex = startIndex + llmCorrection.fragment.length - 1;
				const corrections = await db
					.insert(schema.correction)
					.values({
						messageId: data.messageId,
						reason: llmCorrection.reason,
						start: startIndex,
						end: endIndex
					})
					.returning({ id: schema.correction.id });
				const suggestions = await db.insert(schema.suggestion).values(
					llmCorrection.suggestions.map(({ replacement }) => ({
						correctionId: corrections[0].id,
						replacement
					}))
				);
			}

			// parseamos el json
			// iteramos
			// vemos dónde está correction en content
			// extraemos (start, end)
			// iteramos cada suggestion
			// guardamos cada suggestion

			await db
				.update(schema.message)
				.set({ status: 'complete', content })
				.where(eq(schema.message.id, data.messageId));
		}
	});

	return new Response(readableStream, { headers: { 'content-type': 'text/event-stream' } });
};
