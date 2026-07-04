import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import type { PromptFn } from './utils';
import type {
	ChatCompletionMessageParam,
	ChatCompletionUserMessageParam,
	ChatCompletionAssistantMessageParam
} from 'groq-sdk/resources/chat.js';
import * as z from 'zod';

export const messageReplyResponseSchema = z.object({
	answer: z.string().min(1),
	translation: z.string().min(1)
});

const exampleBlock = ({
	nativeLanguage,
	targetLanguage,
	turns,
	answer,
	translation
}: {
	nativeLanguage: (typeof LANGUAGE_CODES)[number];
	targetLanguage: (typeof LANGUAGE_CODES)[number];
	turns: (ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam)[];
	answer: string;
	translation: string;
}): (ChatCompletionUserMessageParam | ChatCompletionAssistantMessageParam)[] => {
	return [
		{
			role: 'user',
			content: dedent`
				native: ${LANGUAGE_CODE_LABELS.es[nativeLanguage]}
				target: ${LANGUAGE_CODE_LABELS.es[targetLanguage]}
				${turns.map((turn) => `${turn.role}: ${turn.content}`).join('\n')}
			`
		},
		{ role: 'assistant', content: JSON.stringify({ answer, translation }) }
	];
};

export const prompts: PromptFn<
	ChatCompletionMessageParam[],
	{
		nativeLanguage: (typeof LANGUAGE_CODES)[number];
		targetLanguage: (typeof LANGUAGE_CODES)[number];
	}
> = (input, options) => [
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
        `
	},
	...exampleBlock({
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [
			{ role: 'assistant', content: 'What did you do over the weekend?' },
			{ role: 'user', content: 'I went hiking with my brother' },
			{ role: 'assistant', content: 'Nice! Where did you go?' },
			{ role: 'user', content: 'We went to a national park near the mountains' }
		],
		answer: 'That sounds like a great trip. Did you take many photos?',
		translation: 'Suena como un viaje genial. ¿Sacaron muchas fotos?'
	}),
	...exampleBlock({
		nativeLanguage: 'en',
		targetLanguage: 'es',
		turns: [
			{ role: 'assistant', content: '¿Qué vas a hacer esta tarde?' },
			{ role: 'user', content: 'Voy a estudiar para un examen mañana' },
			{ role: 'assistant', content: '¿De qué materia es?' },
			{ role: 'user', content: 'Es de historia, tengo que repasar el siglo XX' }
		],
		answer: 'Buena suerte. ¿Llevas mucho tiempo estudiando?',
		translation: 'Good luck. Have you been studying for long?'
	}),
	...exampleBlock({
		nativeLanguage: 'es',
		targetLanguage: 'en',
		turns: [
			{ role: 'assistant', content: 'How was your day at work?' },
			{ role: 'user', content: 'It was okay, pretty busy' },
			{ role: 'assistant', content: 'What kept you busy?' },
			{ role: 'user', content: 'Something about the thing with the client yesterday, idk' }
		],
		answer: "I'm not sure I follow — what happened with the client yesterday?",
		translation: 'No estoy seguro de entender — ¿qué pasó con el cliente ayer?'
	}),
	{
		role: 'user',
		content: dedent`
			native: ${LANGUAGE_CODE_LABELS.es[options.nativeLanguage]}
			target: ${LANGUAGE_CODE_LABELS.es[options.targetLanguage]}
			${input.map((turn) => `${turn.role}: ${turn.content}`).join('\n')}
		`
	}
];
