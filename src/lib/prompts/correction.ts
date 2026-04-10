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
	string,
	{ nativeLanguage: (typeof LANGUAGES)[number]; targetLanguage: (typeof LANGUAGES)[number] }
> = (input, options) => [
	{
		role: 'system',
		content: dedent`
            Actúa como un corrector gramatical y de estilo.

            Contexto:
            - El usuario es hablante nativo de ${options.nativeLanguage}.
            - Está aprendiendo ${options.targetLanguage} y escribe mensajes en ese idioma.

            Tarea:
            - Detectar errores en el mensaje.
            - Responder SIEMPRE con un JSON válido.
            - Retornar un array con una entrada por cada error.

            Formato:
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
            - "fragment": solo el fragmento incorrecto.
            - "reason": snake_case (grammar_error, spelling_error, unnatural_expression, etc).
            - "suggestions": una o más alternativas naturales.
            - No texto fuera del JSON.
            - Si no hay errores: []

            Criterios:
            - Priorizar naturalidad.
            - No sobrecorregir.
        `
	} as const,
	...examples[options.targetLanguage],
	{ role: 'user', content: input }
];

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
		{ role: 'user', content: 'Yo tengo 25 años viejo' },
		{
			role: 'assistant',
			content: dedent`
                [
                    {
                        "fragment": "viejo",
                        "reason": "unnatural_expression",
                        "suggestions": [
                        { "replacement": "años" }
                        ]
                    }
                ]
            `
		},
		{ role: 'user', content: 'Ella es muy simpatico y trabaja en un hospital grande' },
		{
			role: 'assistant',
			content: dedent`
               [
                    {
                        "fragment": "simpatico",
                        "reason": "gender_agreement_error",
                        "suggestions": [
                        { "replacement": "simpática" }
                        ]
                    }
                ]
            `
		},
		{ role: 'user', content: 'Ayer fui al supermercado' },
		{ role: 'assistant', content: '[]' }
	]
};
