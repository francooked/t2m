import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import type {
	ChatCompletionUserMessageParam,
	ChatCompletionAssistantMessageParam,
	ChatCompletionSystemMessageParam
} from 'groq-sdk/resources/chat.js';
import * as z from 'zod';

export const inputSchema = z
	.object({
		nativeLanguage: z.enum(LANGUAGE_CODES),
		targetLanguage: z.enum(LANGUAGE_CODES),
		turns: z.array(z.object({ role: z.enum(['assistant', 'user']), content: z.string() }))
	})
	.refine(({ nativeLanguage, targetLanguage, turns }) => {
		return (
			nativeLanguage !== targetLanguage &&
			turns.every(({ role }, index) => (index % 2 === 0 ? role === 'user' : role === 'assistant'))
		);
	});

export const outputSchema = z.object({
	answer: z.string().min(1),
	translation: z.string().min(1)
});

export const buildFewShot = ({
	input,
	output
}: {
	input: z.infer<typeof inputSchema>;
	output?: z.infer<typeof outputSchema>;
}): (ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam)[] => {
	const turns: (ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam)[] = [
		{
			role: 'user',
			content: JSON.stringify({
				nativeLanguage: LANGUAGE_CODE_LABELS.es[input.nativeLanguage],
				targetLanguage: LANGUAGE_CODE_LABELS.es[input.targetLanguage],
				turns: input.turns
			})
		}
	];
	if (output) turns.push({ role: 'assistant', content: JSON.stringify(output) });
	return turns;
};

export const fewShots: ReturnType<typeof buildFewShot> = [
	...buildFewShot({
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'assistant', content: 'What did you do over the weekend?' },
				{ role: 'user', content: 'I went hiking with my brother' },
				{ role: 'assistant', content: 'Nice! Where did you go?' },
				{ role: 'user', content: 'We went to a national park near the mountains' }
			]
		},
		output: {
			answer: 'That sounds like a great trip. Did you take many photos?',
			translation: 'Suena como un viaje genial. ¿Sacaron muchas fotos?'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Qué vas a hacer esta tarde?' },
				{ role: 'user', content: 'Voy a estudiar para un examen mañana' },
				{ role: 'assistant', content: '¿De qué materia es?' },
				{ role: 'user', content: 'Es de historia, tengo que repasar el siglo XX' }
			]
		},
		output: {
			answer: 'Buena suerte. ¿Llevas mucho tiempo estudiando?',
			translation: 'Good luck. Have you been studying for long?'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'assistant', content: 'How was your day at work?' },
				{ role: 'user', content: 'It was okay, pretty busy' },
				{ role: 'assistant', content: 'What kept you busy?' },
				{ role: 'user', content: 'Something about the thing with the client yesterday, idk' }
			]
		},
		output: {
			answer: "I'm not sure I follow — what happened with the client yesterday?",
			translation: 'No estoy seguro de entender — ¿qué pasó con el cliente ayer?'
		}
	})
];

export const buildPrompt = (
	input: z.infer<typeof inputSchema>
): (
	| ChatCompletionSystemMessageParam
	| ChatCompletionUserMessageParam
	| ChatCompletionAssistantMessageParam
)[] => [
	{
		role: 'system',
		content: dedent`
        Eres un compañero de conversación para practicar idiomas de manera natural.

        Respuesta (solo JSON):
        { "answer": "<idioma objetivo>", "translation": "<idioma nativo>" }

        Reglas:
        - Responde SOLO al último mensaje.
        - Si no entiendes, pide aclaración de forma natural.
        - Tu respuesta debe mantener la conversación activa.
		- "answer" SIEMPRE en el idioma objetivo (targetLanguage).
		- "translation" SIEMPRE en el idioma nativo (nativeLanguage).
		- Texto plano, sin markdown.
        `
	},
	...fewShots,
	...buildFewShot({ input })
];
