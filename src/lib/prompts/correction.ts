import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat.js';
import { LANGUAGES } from '$lib/constants';
import dedent from 'dedent';
import type { PromptFn } from './utils';

export type LLMCorrectionItem = {
	fragment: string;
	reason: string;
	suggestions: { replacement: string }[];
};
export type LLMCorrectionResponse = LLMCorrectionItem[];

// Si el mismo error se repite dos o más veces, solo enviar la primera coincidencia,
// siempre que sean iguales. Si ya involucra verbos auxiliares entremedio, o la frase completa
// está incorrecta (la frase incluye el error repetido), mejor considerar todo como un gran error.
export const prompts: PromptFn<
	ChatCompletionMessageParam[],
	{ nativeLanguage: (typeof LANGUAGES)[number]; targetLanguage: (typeof LANGUAGES)[number] }
> = (input, options) => {
	const targetMessage = input.at(-1);
	if (targetMessage?.role !== 'user') throw new Error('Last message is not a user message.');

	return [
		{
			role: 'system',
			content: dedent`
            Actúa como un corrector gramatical y de estilo.

            Contexto:
            - El usuario es hablante nativo de ${options.nativeLanguage}.
            - Está aprendiendo ${options.targetLanguage} y escribe mensajes en ese idioma.
            - Recibirás una conversación corta (0 a 3 mensajes previos).
            - Los mensajes pueden tener rol "assistant" o "user".

            Tarea:
            - Debes corregir ÚNICAMENTE el mensaje que comienza con "[TARGET]".
            - Usa los mensajes previos solo como contexto para entender el significado.
            - No corrijas mensajes anteriores.

            Formato de respuesta (OBLIGATORIO):
            [
                {
                    "fragment": string,
                    "reason": string,
                    "suggestions": [
                        { "replacement": string }
                    ]
                }
            ]

            Reglas:
            - "fragment": debe ser el fragmento incorrecto del mensaje marcado con [TARGET]
            - "reason": código en snake_case (grammar_error, verb_tense_error, wrong_preposition, article_error, spelling_error, unnatural_expression, etc).
            - "suggestions": una o más alternativas correctas y naturales.
            - No texto fuera del JSON.
            - Si no hay errores: []

            Criterios:
            - Usa el contexto para decidir significado, preposiciones y tiempos verbales.
            - Prioriza naturalidad sobre literalidad.
            - No sobrecorregir.
            - No infieras errores si la frase es válida en contexto.
        `
		} as const,
		...examples[options.targetLanguage],
		...(input.length > 1 ? input.slice(0, -1) : []),
		{ role: 'user', content: `[TARGET]\n${targetMessage.content}` }
	];
};

const examples: { [K in (typeof LANGUAGES)[number]]: ChatCompletionMessageParam[] } = {
	en: [
		{ role: 'user', content: 'I did a party in my house' },
		{
			role: 'assistant',
			content: dedent`
                [
                    {
                        "fragment": "did a party",
                        "reason": "unnatural_expression",
                        "suggestions": [
                        { "replacement": "had a party" },
                        { "replacement": "threw a party" }
                        ]
                    },
                    {
                        "fragment": "in my house",
                        "reason": "unnatural_expression",
                        "suggestions": [
                        { "replacement": "at my house" }
                        ]
                    }
                ]
            `
		},
		{ role: 'user', content: 'She have 25 years and work in a office' },
		{
			role: 'assistant',
			content: dedent`
                [
                    {
                        "fragment": "have",
                        "reason": "grammar_error",
                        "suggestions": [
                        { "replacement": "has" }
                        ]
                    },
                    {
                        "fragment": "25 years",
                        "reason": "unnatural_expression",
                        "suggestions": [
                        { "replacement": "25 years old" }
                        ]
                    },
                    {
                        "fragment": "work",
                        "reason": "verb_tense_error",
                        "suggestions": [
                        { "replacement": "works" }
                        ]
                    },
                    {
                        "fragment": "a office",
                        "reason": "article_error",
                        "suggestions": [
                        { "replacement": "an office" }
                        ]
                    }
                ]
            `
		},
		{ role: 'user', content: 'I went to the gym yesterday' },
		{ role: 'assistant', content: '[]' }
	],
	es: [
		// Example 1
		{ role: 'assistant', content: '¿A dónde vas ahora?' },
		{ role: 'user', content: 'Voy en el gimnasio' },
		{ role: 'assistant', content: '¿A entrenar?' },
		{ role: 'user', content: '[TARGET]\nVoy en el gimnasio' },
		{
			role: 'assistant',
			content: dedent`
                [
                    {
                        "fragment": "en el gimnasio",
                        "reason": "wrong_preposition",
                        "suggestions": [
                            { "replacement": "al gimnasio" }
                        ]
                    }
                ]
            `
		},
		// Example 2
		{ role: 'assistant', content: '¿Cómo está la comida?' },
		{ role: 'user', content: 'Muy rica' },
		{ role: 'assistant', content: 'Qué bueno.' },
		{ role: 'user', content: '[TARGET]\nLa comida es fría' },
		{
			role: 'assistant',
			content: dedent`
            [
                {
                    "fragment": "es",
                    "reason": "ser_vs_estar_error",
                    "suggestions": [
                        { "replacement": "está" }
                    ]
                }
            ]
        `
		},
		// Example 3
		{ role: 'assistant', content: '¿Cuántos años tiene tu hermano?' },
		{ role: 'user', content: 'Tiene 20 años' },
		{ role: 'assistant', content: 'Ah, es joven.' },
		{ role: 'user', content: '[TARGET]\nHace 25 años' },
		{
			role: 'assistant',
			content: dedent`
                [
                    {
                        "fragment": "Hace 25 años",
                        "reason": "unnatural_expression",
                        "suggestions": [
                            { "replacement": "Tiene 25 años" }
                        ]
                    }
                ]
            `
		},
		// Example 4
		{ role: 'assistant', content: '¿Qué hiciste el fin de semana?' },
		{ role: 'user', content: 'Salí con amigos' },
		{ role: 'assistant', content: '¿A dónde fueron?' },
		{ role: 'user', content: '[TARGET]\nFuimos a un bar en el centro' },
		{ role: 'assistant', content: '[]' }
	]
};
