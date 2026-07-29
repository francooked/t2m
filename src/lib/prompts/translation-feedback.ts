import * as z from 'zod';
import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import type {
	ChatCompletionAssistantMessageParam,
	ChatCompletionUserMessageParam,
	ChatCompletionSystemMessageParam
} from 'groq-sdk/resources/chat.js';

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
				original: input.original,
				expected: input.expected,
				answer: input.answer
			})
		}
	];
	if (output) turns.push({ role: 'assistant', content: JSON.stringify(output) });
	return turns;
};

export const fewShots: ReturnType<typeof buildFewShot> = [
	...buildFewShot({
		input: {
			original: 'Quiero comer',
			expected: 'I want to eat',
			answer: 'I want eat',
			nativeLanguage: 'es',
			targetLanguage: 'en'
		},
		output: {
			tips: [
				'"want" necesita "to" antes de otro verbo: "want to eat".',
				'En inglés, verbo + verbo suele requerir "to" (p. ej. "want to go").'
			]
		}
	}),
	...buildFewShot({
		input: {
			original: 'Voy al trabajo',
			expected: 'I go to work',
			answer: 'I am going to work',
			nativeLanguage: 'es',
			targetLanguage: 'en'
		},
		output: {
			tips: [
				'La respuesta esperada usa presente simple: "I go to work".',
				'"I am going" es presente continuo y cambia el significado.'
			]
		}
	}),
	...buildFewShot({
		input: {
			original: 'I go to the gym',
			expected: 'Voy al gimnasio',
			answer: 'Voy a gimnasio',
			nativeLanguage: 'en',
			targetLanguage: 'es'
		},
		output: {
			tips: [
				'Use "al" (a + el) before "gimnasio": "Voy al gimnasio".',
				'"a gimnasio" is missing the article "el".'
			]
		}
	}),
	...buildFewShot({
		input: {
			original: 'I would like a coffee',
			expected: 'Quisiera un café',
			answer: 'Quiero un café',
			nativeLanguage: 'en',
			targetLanguage: 'es'
		},
		output: {
			tips: [
				'"Quisiera" is more polite than "Quiero" for requests.',
				'"Quiero un café" sounds direct; use "Quisiera" to be courteous.'
			]
		}
	}),
	...buildFewShot({
		input: {
			original: 'She told me at the meeting',
			expected: 'Me lo dijo en la reunión',
			answer: 'Me lo dijo a la reunión',
			nativeLanguage: 'en',
			targetLanguage: 'es'
		},
		output: {
			tips: ['Use "en" (not "a") for being inside an event: "en la reunión".']
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
            Actúa como tutor breve de idiomas.

            Tarea:
            - Explicar brevemente qué debe cambiar para acercarse a la respuesta esperada.

            Contexto:
            - Idioma nativo del usuario: ${LANGUAGE_CODE_LABELS.es[input.nativeLanguage]}
            - Idioma objetivo: ${LANGUAGE_CODE_LABELS.es[input.targetLanguage]}

            Entrada:
            - original: frase o contexto original.
            - expected: respuesta esperada exacta.
            - answer: respuesta del usuario.

            Formato de respuesta (OBLIGATORIO):
            { "tips": string[] }
            
            Reglas:
            - Máximo 3 tips, enfocados en los errores más importantes.
			- Texto plano, SIN markdown (nada de *, _, backticks, viñetas ni encabezados).
            - Cada tip breve: máximo ~15 palabras.
            - Escribe los tips en ${LANGUAGE_CODE_LABELS.es[input.nativeLanguage]}.
			- Puedes incluir pequeñas frases en ${LANGUAGE_CODE_LABELS.es[input.targetLanguage]}.
            `
	},
	...fewShots,
	...buildFewShot({ input })
];
