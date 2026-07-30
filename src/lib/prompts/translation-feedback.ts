import * as z from 'zod';
import { LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import type {
	ChatCompletionAssistantMessageParam,
	ChatCompletionUserMessageParam,
	ChatCompletionSystemMessageParam
} from 'groq-sdk/resources/chat.js';
import { buildLanguageRules, languageName, selectExamples, type LanguagePair } from './utils';

export const inputSchema = z
	.object({
		nativeLanguage: z.enum(LANGUAGE_CODES),
		targetLanguage: z.enum(LANGUAGE_CODES),
		original: z.string().min(1),
		expected: z.string().min(1),
		answer: z.string().min(1)
	})
	.refine(({ nativeLanguage, targetLanguage, expected, answer }) => {
		return nativeLanguage !== targetLanguage && expected !== answer;
	});

export const outputSchema = z.object({
	tips: z.array(z.string().min(1)).max(3)
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
				writeTipsIn: languageName(input.nativeLanguage),
				original: input.original,
				expected: input.expected,
				answer: input.answer
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
			original: 'Quiero comer',
			expected: 'I want to eat',
			answer: 'I want eat'
		},
		output: {
			tips: ['Falta "to": después de "want" el otro verbo va con "to want to eat".']
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			original: 'Voy al trabajo todos los días',
			expected: 'I go to work every day',
			answer: 'I am going to work every day'
		},
		output: {
			tips: [
				'Para una rutina se usa presente simple: "I go to work".',
				'"I am going" es presente continuo y suena a algo puntual.'
			]
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			original: 'Ayer fui a la tienda',
			expected: 'Yesterday I went to the store',
			answer: 'I went to the store yesterday'
		},
		output: {
			tips: ['Tu respuesta también es correcta; "yesterday" puede ir al final o al inicio.']
		}
	},
	// nativeLanguage: en, targetLanguage: es
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			original: 'I go to the gym',
			expected: 'Voy al gimnasio',
			answer: 'Voy a gimnasio'
		},
		output: {
			tips: ['"gimnasio" needs the article: "a" + "el" becomes "al gimnasio".']
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			original: 'She told me at the meeting',
			expected: 'Me lo dijo en la reunión',
			answer: 'Me lo dijo a la reunión'
		},
		output: {
			tips: ['Use "en" for being inside an event: "en la reunión", not "a la reunión".']
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			original: 'My sister is very tall',
			expected: 'Mi hermana es muy alta',
			answer: 'Mi hermana es muy alto'
		},
		output: {
			tips: ['"hermana" is feminine, so the adjective becomes "alta".']
		}
	}
];

const buildSystemPrompt = ({ nativeLanguage, targetLanguage }: LanguagePair): string => {
	const target = languageName(targetLanguage);
	const native = languageName(nativeLanguage);

	return dedent`
		Eres un tutor de idiomas. El usuario tradujo una frase a ${target} y tú explicas la diferencia con la respuesta esperada.

		${buildLanguageRules({ nativeLanguage, targetLanguage })}

		Entrada:
		- original: la frase en ${native} que el usuario tenía que expresar.
		- expected: la respuesta esperada en ${target}.
		- answer: lo que escribió el usuario.

		Reglas:
		- Máximo 3 tips, uno por diferencia; parte por la más importante.
		- Cada tip: una frase en ${native}, máximo 15 palabras, y puedes citar palabras en ${target} entre comillas.
		- Compara solo answer con expected; no corrijas cosas que el usuario escribió bien.
		- Si la diferencia es solo de tildes, mayúsculas o puntuación, dilo en un único tip.
		- Si answer también es correcta y natural aunque no sea idéntica a expected, dilo en un solo tip.
		- Texto plano: sin markdown, sin viñetas, sin numeración.

		Responde SOLO con este JSON:
		{"tips":["..."]}

		Antes de responder, revisa: cada tip está completo en ${native}, sin una sola palabra de ${target} fuera de comillas. Si no, reescríbelo.
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
