import type { ChatCompletionMessageParam } from 'groq-sdk/resources/chat.js';
import { LANGUAGES } from '$lib/constants';
import dedent from 'dedent';
import type { PromptFn } from './utils';
import z from 'zod';

export const messageCorrectionResponseSchema = z.object({
	translation: z.string().min(1),
	corrections: z.array(
		z.object({
			fragment: z.string().min(1),
			reason: z.string().min(1),
			suggestions: z.array(z.object({ replacement: z.string() }))
		})
	)
});

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
            {
                "translation": "string",
                "corrections": 
                [
                    {
                        "fragment": "string",
                        "reason": "string",
                        "suggestions":
                        [
                            { "replacement": "string" }
                        ]
                    }
                ]
            }

            Reglas:
            - "translation": interpretación natural en ${options.nativeLanguage} del mensaje [TARGET] ya corregido.
            - "fragment": debe ser una subcadena exacta del mensaje [TARGET], copiando mayúsculas, tildes, espacios y puntuación.
            - "reason": código en snake_case (grammar_error, verb_tense_error, wrong_preposition, article_error, spelling_error, unnatural_expression, etc).
            - "suggestions": una o más alternativas correctas y naturales.
            - No texto fuera del JSON.
            - Si no hay errores: { "translation": "...", corrections: [] }

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
                {
                    "translation": "",
                    "corrections":
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
                }
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
		// We asume that the native language is English.
		// Example 1.
		{ role: 'assistant', content: '¿A dónde vas ahora?' },
		{ role: 'user', content: '[TARGET]\nVoy en el gimnasio' },
		{
			role: 'assistant',
			content: dedent`
            {
                "translation": "I'm going to the gym",
                "corrections":
                [
                    {
                        "fragment": "en el",
                        "reason": "wrong_preposition",
                        "suggestions": 
                        [
                            { "replacement": "al" }
                        ]
                    }
                ]
            }
            `
		},
		// Example 2.
		{ role: 'assistant', content: '¿Cómo está la comida?' },
		{ role: 'user', content: 'Muy rica' },
		{ role: 'assistant', content: 'Qué bueno.' },
		{ role: 'user', content: '[TARGET]\nLa comida es poco fría si' },
		{
			role: 'assistant',
			content: dedent`
            {
                "translation": "The food is cold though",
                "corrections":
                [
                    {
                        "fragment": "es",
                        "reason": "ser_vs_estar_error",
                        "suggestions": 
                        [
                            { "replacement": "está" }
                        ]
                    },
                    {
                        "fragment": "poco fría",
                        "reason": "unnatural_expression",
                        "suggestions": 
                        [
                            { "replacement": "fría" }
                        ]
                    },
                    {
                        "fragment": " si",
                        "reason": "unnatural_expression",
                        "suggestions": 
                        [
                            { "replacement": ", eso sí" }
                        ]
                    }
                ]
            }
        `
		},
		// Example 3
		{ role: 'assistant', content: '¿Cuántos años tiene tu hermano?' },
		{ role: 'user', content: 'Tiene 20 años' },
		{ role: 'assistant', content: 'Ah, es joven.' },
		{ role: 'user', content: '[TARGET]\nSi, pero nos llevamos por 5 años, no es tan mucho' },
		{
			role: 'assistant',
			content: dedent`
            {
                "translation": "Yes, but there's only a five-year difference between us, it's not that much",
                "corrections":
                [
                    {
                        "fragment": "Si",
                        "reason": "spelling_error",
                        "suggestions":
                        [
                            { "replacement": "Sí" }
                        ]
                    },
                    {
                        "fragment": "tan mucho",
                        "reason": "unnatural_expression",
                        "suggestions": 
                        [
                            { "replacement": "tanto" },
                            { "replacement": "demasiado" }
                        ]
                    }
                ]
            }
            `
		},
		// Example 4
		{ role: 'assistant', content: '¿Qué hiciste el fin de semana?' },
		{ role: 'user', content: 'Salí con amigos' },
		{ role: 'assistant', content: '¿A dónde fueron?' },
		{ role: 'user', content: '[TARGET]\nFuimos a un bar en el centro' },
		{
			role: 'assistant',
			content: dedent`
            {
                "translation": "We went to a bar downtown",
                "corrections": []
            }
            `
		}
	]
};
