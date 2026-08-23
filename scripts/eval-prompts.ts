/**
 * Manual prompt eval: runs held-out cases against Groq and prints the raw output.
 * Usage: npx tsx --env-file=.env scripts/eval-prompts.ts [correction|reply|feedback|patterns]
 */
import Groq from 'groq-sdk';
import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat.js';
import * as z from 'zod';
import * as correction from '../src/lib/prompts/message-correction';
import * as reply from '../src/lib/prompts/conversation-reply';
import * as feedback from '../src/lib/prompts/translation-feedback';
import * as errorPatterns from '../src/lib/prompts/error-patterns';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const MODEL = 'openai/gpt-oss-20b';

async function run(
	name: string,
	messages: ChatCompletionMessageParam[],
	schema: z.ZodType,
	temperature: number
) {
	const completion = await groq.chat.completions.create({
		messages,
		model: MODEL,
		response_format: {
			type: 'json_schema',
			json_schema: { name, strict: false, schema: z.toJSONSchema(schema, { io: 'input' }) }
		},
		temperature,
		max_completion_tokens: 4096,
		top_p: 1,
		stop: null
	});

	// Keeps the free tier from hitting its tokens-per-minute limit.
	await new Promise((resolve) => setTimeout(resolve, 8000));

	const content = completion.choices.at(0)?.message.content ?? '';
	try {
		return schema.parse(JSON.parse(content));
	} catch {
		return { PARSE_ERROR: content };
	}
}

const correctionCases: correction.Input[] = [
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		turns: [
			{ role: 'user', content: 'Quiero contarte de mi fin de semana' },
			{ role: 'assistant', content: '¡Cuéntame! ¿Qué hiciste?' },
			{ role: 'user', content: 'Yo comprar dos libro nuevo la semana pasado' }
		]
	},
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		turns: [
			{ role: 'user', content: '¿Cómo está tu amiga?' },
			{ role: 'assistant', content: 'Cuéntame de ella, ¿qué ha estado haciendo?' },
			{ role: 'user', content: 'Mi amiga es cansada porque ella trabajó mucho ayer' }
		]
	},
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		turns: [{ role: 'user', content: 'Me encanta caminar por la playa en la mañana' }]
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [
			{ role: 'user', content: 'Hi, I want to talk about last weekend' },
			{ role: 'assistant', content: 'Sure, what did you do?' },
			{ role: 'user', content: 'I have go to the party yesterday and we dancing all night' }
		]
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [
			{ role: 'user', content: 'Do you like animals?' },
			{ role: 'assistant', content: 'I do! Do you have any pets?' },
			{ role: 'user', content: 'She have two cat and they is very playful' }
		]
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [{ role: 'user', content: 'I usually read a book before going to bed' }]
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [
			{ role: 'user', content: 'Hello, I want to practice my English' },
			{ role: 'assistant', content: 'Great! What do you do for a living?' },
			{ role: 'user', content: 'I am a teacher in a small school' },
			{ role: 'assistant', content: 'That sounds rewarding. What subject do you teach?' },
			{ role: 'user', content: 'I teach math to teenagers' },
			{ role: 'assistant', content: 'Nice! Do they enjoy your classes?' },
			{ role: 'user', content: 'Yesterday my student no understand the lesson so I explain again' }
		]
	},
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		turns: [
			{ role: 'user', content: 'Ayer fui al cine' },
			{ role: 'assistant', content: '¿Qué película viste?' },
			{ role: 'user', content: 'Vi una película de terror, pero me dormí en la mitad jaja' }
		]
	}
];

const replyCases: reply.Input[] = [
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		turns: [{ role: 'user', content: 'Hi, I want to practice for my trip' }]
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [
			{ role: 'user', content: 'I like cooking on weekends' },
			{ role: 'assistant', content: 'What do you usually cook?' },
			{ role: 'user', content: 'Normalmente hago pasta o algo simple' }
		]
	}
];

const feedbackCases: feedback.Input[] = [
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		original: 'I planned it last year',
		expected: 'Lo planeé el año pasado',
		answer: 'Lo planee la año pasado'
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		original: 'Ella no trabaja, estudia en la universidad',
		expected: "She doesn't work, she studies at university",
		answer: "She don't work, she study at university"
	}
];

const patternCases: errorPatterns.Input[] = [
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		mistakes: [
			{
				wrote: 'I have go to the party yesterday and we dancing all night',
				instead: 'I went to the party yesterday and we danced all night',
				note: '"yesterday" pide pasado: "went" y "danced", no "have go" ni "dancing".'
			},
			{
				wrote: 'Yesterday my student no understand the lesson so I explain again',
				instead: 'Yesterday my student did not understand the lesson so I explained again',
				note: 'En pasado, la negación va con "did not" y el verbo en pasado: "explained".'
			},
			{
				wrote: 'She have two cat and they is very playful',
				instead: 'She has two cats and they are very playful',
				note: 'Con "she" el verbo es "has"; "cat" plural "cats"; "they" lleva "are".'
			}
		]
	},
	{
		nativeLanguage: 'es',
		targetLanguage: 'en',
		mistakes: [
			{
				wrote: 'I live here since 2019',
				instead: 'I have lived here since 2019',
				note: 'Con "since" se usa presente perfecto: "have lived".'
			},
			{
				wrote: 'I know him since the school',
				instead: 'I have known him since school',
				note: '"since" pide presente perfecto: "have known".'
			},
			{
				wrote: 'Can you explain me the homework',
				instead: 'Can you explain the homework to me',
				note: '"explain" no lleva objeto de persona pegado: "explain X to me".'
			}
		]
	},
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		mistakes: [
			{
				wrote: 'Yo comprar dos libro nuevo la semana pasado',
				instead: 'Yo compré dos libros nuevos la semana pasada',
				note: 'Need past tense "compré", plural "libros nuevos", and feminine "pasada".'
			},
			{
				wrote: 'Yo gustaría ir chile este verano',
				instead: 'Me gustaría ir a Chile este verano',
				note: '"gustar" takes "me gustaría", and "ir" needs "a" before a country.'
			},
			{
				wrote: 'No conozco nadie en la fiesta',
				instead: 'No conozco a nadie en la fiesta',
				note: '"conocer" needs "a" before a person, also with "nadie".'
			}
		]
	},
	{
		nativeLanguage: 'en',
		targetLanguage: 'es',
		mistakes: [
			{
				wrote: 'Lo planee la año pasado',
				instead: 'Lo planeé el año pasado',
				note: '"planeé" needs the accent, and "año" is masculine: "el año pasado".'
			},
			{
				wrote: 'Mis hermana son muy alto y trabaja en un hospital',
				instead: 'Mi hermana es muy alta y trabaja en un hospital',
				note: 'One sister is singular "mi hermana es", and "alta" is feminine.'
			},
			{
				wrote: 'Estoy aburrido a esta fiesta',
				instead: 'Estoy aburrido en esta fiesta',
				note: 'Use "en" for being inside a place, not "a".'
			}
		]
	}
];

const which = process.argv[2] ?? 'all';
const runs = Number(process.argv[3] ?? 1);

if (which === 'all' || which === 'correction') {
	for (const input of correctionCases) {
		for (let attempt = 1; attempt <= runs; attempt++) {
			const output = await run(
				'message_correction',
				correction.buildPrompt(input),
				correction.outputSchema,
				0
			);
			console.log(
				`\n=== correction ${input.nativeLanguage}->${input.targetLanguage} #${attempt} ===\n${input.turns.at(-1)?.content}`
			);
			console.dir(output, { depth: null });
		}
	}
}

if (which === 'all' || which === 'reply') {
	for (const input of replyCases) {
		const output = await run('message_reply', reply.buildPrompt(input), reply.outputSchema, 0.5);
		console.log(
			`\n=== reply ${input.nativeLanguage}->${input.targetLanguage} ===\n${input.turns.at(-1)?.content}`
		);
		console.dir(output, { depth: null });
	}
}

if (which === 'all' || which === 'feedback') {
	for (const input of feedbackCases) {
		const output = await run(
			'translation_feedback',
			feedback.buildPrompt(input),
			feedback.outputSchema,
			0
		);
		console.log(
			`\n=== feedback ${input.nativeLanguage}->${input.targetLanguage} ===\n${input.answer}`
		);
		console.dir(output, { depth: null });
	}
}

if (which === 'all' || which === 'patterns') {
	for (const input of patternCases) {
		const output = await run(
			'error_patterns',
			errorPatterns.buildPrompt(input),
			errorPatterns.outputSchema,
			0
		);
		console.log(
			`\n=== patterns ${input.nativeLanguage}->${input.targetLanguage} ===\n${input.mistakes.map((mistake) => mistake.wrote).join(' | ')}`
		);
		console.dir(output, { depth: null });
	}
}
