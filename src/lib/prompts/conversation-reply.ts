import { LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import type {
	ChatCompletionUserMessageParam,
	ChatCompletionAssistantMessageParam,
	ChatCompletionSystemMessageParam
} from 'groq-sdk/resources/chat.js';
import * as z from 'zod';
import {
	buildLanguageRules,
	languageName,
	selectExamples,
	takeLastTurns,
	type LanguagePair
} from './utils';

// How many turns of context the partner sees. Enough to keep the thread, short enough to stay focused.
const CONTEXT_TURNS = 9;

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

export type Input = z.infer<typeof inputSchema>;
export type Output = z.infer<typeof outputSchema>;

type Example = { input: Input; output: Output };

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
				nativeLanguage: languageName(input.nativeLanguage),
				targetLanguage: languageName(input.targetLanguage),
				writeAnswerIn: languageName(input.targetLanguage),
				writeTranslationIn: languageName(input.nativeLanguage),
				turns: takeLastTurns(input.turns, CONTEXT_TURNS)
			})
		}
	];
	if (output) turns.push({ role: 'assistant', content: JSON.stringify(output) });
	return turns;
};

export const examples: Example[] = [
	// nativeLanguage: es, targetLanguage: en
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'user', content: 'I went hiking with my brother' },
				{ role: 'assistant', content: 'Nice! Where did you go?' },
				{ role: 'user', content: 'We went to a national park near the mountains' }
			]
		},
		output: {
			answer: 'That sounds like a great trip. Did you take many photos?',
			translation: 'Suena como un viaje genial. ¿Sacaron muchas fotos?'
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'user', content: 'My day at work was okay, pretty busy' },
				{ role: 'assistant', content: 'What kept you busy?' },
				{ role: 'user', content: 'Something about the thing with the client yesterday, idk' }
			]
		},
		output: {
			answer: "I'm not sure I follow. What happened with the client yesterday?",
			translation: 'No estoy seguro de entender. ¿Qué pasó con el cliente ayer?'
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [{ role: 'user', content: 'Hola, hoy tuve un día muy largo en la oficina' }]
		},
		output: {
			answer: 'Long days are tough. What made today so busy at the office?',
			translation: 'Los días largos son duros. ¿Qué hizo que hoy fuera tan ocupado en la oficina?'
		}
	},
	// nativeLanguage: en, targetLanguage: es
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Voy a estudiar para un examen mañana' },
				{ role: 'assistant', content: '¿De qué materia es?' },
				{ role: 'user', content: 'Es de historia, tengo que repasar el siglo XX' }
			]
		},
		output: {
			answer: 'Buena suerte. ¿Llevas mucho tiempo estudiando?',
			translation: 'Good luck. Have you been studying for long?'
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [{ role: 'user', content: 'Quiero practicar para mi viaje a Chile' }]
		},
		output: {
			answer: '¡Buen plan! ¿Cuándo viajas y qué lugares quieres visitar?',
			translation: 'Good plan! When are you traveling and which places do you want to visit?'
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Ayer cociné para mis amigos' },
				{ role: 'assistant', content: '¿Qué preparaste?' },
				{ role: 'user', content: 'I made pasta, but I forgot the word for the sauce' }
			]
		},
		output: {
			answer: 'La salsa, entonces. ¿Qué salsa hiciste para la pasta?',
			translation: 'The sauce, then. Which sauce did you make for the pasta?'
		}
	}
];

const buildSystemPrompt = ({ nativeLanguage, targetLanguage }: LanguagePair): string => {
	const target = languageName(targetLanguage);
	const native = languageName(nativeLanguage);

	return dedent`
		Eres un compañero de conversación para practicar ${target} de forma natural.

		${buildLanguageRules({ nativeLanguage, targetLanguage })}

		Reglas:
		- Responde SOLO al último mensaje del usuario.
		- "answer" siempre en ${target}, incluso si el usuario escribe en ${native} o mezcla idiomas.
		- "translation" es la traducción de tu propio "answer" a ${native}.
		- Máximo 2 oraciones, con una pregunta que mantenga la conversación viva.
		- Usa un vocabulario simple y parecido al del usuario; no cambies de tema de golpe.
		- Si no entiendes el mensaje, pídele que lo aclare de forma natural.
		- No corrijas ni comentes los errores del usuario: de eso se encarga otra parte del sistema.
		- Texto plano, sin markdown ni emojis.

		Responde SOLO con este JSON:
		{"answer":"...","translation":"..."}

		Antes de responder, revisa: "answer" está en ${target} y "translation" está completo en ${native}. Si no, reescríbelos.
	`;
};

export const buildPrompt = (
	input: z.infer<typeof inputSchema>
): (
	| ChatCompletionSystemMessageParam
	| ChatCompletionUserMessageParam
	| ChatCompletionAssistantMessageParam
)[] => [
	{ role: 'system', content: buildSystemPrompt(input) },
	...selectExamples(examples, input).flatMap((example) => buildFewShot(example)),
	...buildFewShot({ input })
];
