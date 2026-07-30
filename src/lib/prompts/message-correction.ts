import type {
	ChatCompletionAssistantMessageParam,
	ChatCompletionUserMessageParam,
	ChatCompletionSystemMessageParam
} from 'groq-sdk/resources/chat.js';
import { LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import * as z from 'zod';
import { normalizeText } from '$lib/correction/normalize-text';
import {
	buildLanguageRules,
	languageName,
	selectExamples,
	takeLastTurns,
	type LanguagePair
} from './utils';

// How many turns of context the corrector sees. Only the last user message is corrected.
const CONTEXT_TURNS = 3;

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
	steps: z.array(
		z.object({
			sentence: z
				.string()
				.trim()
				.min(1)
				.transform((sentence) => normalizeText(sentence)),
			reason: z.string().min(1)
		})
	),
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
				writeSentencesIn: languageName(input.targetLanguage),
				writeReasonsAndTranslationIn: languageName(input.nativeLanguage),
				turns: takeLastTurns(input.turns, CONTEXT_TURNS)
			})
		}
	];
	if (output) turns.push({ role: 'assistant', content: JSON.stringify(output) });
	return turns;
};

export const examples: Example[] = [
	// nativeLanguage: en, targetLanguage: es
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Hola, quiero practicar mi español' },
				{ role: 'assistant', content: '¡Perfecto! ¿Planeaste tu viaje con tiempo?' },
				{ role: 'user', content: 'Sí, haberlo planear la año pasada' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Sí, lo planeé la año pasada',
					reason:
						'to say it already happened you need the past tense "lo planeé", not "haberlo planear"'
				},
				{
					sentence: 'Sí, lo planeé el año pasado',
					reason: '"año" is masculine, so it takes "el" and "pasado"'
				}
			],
			translation: 'Yes, I planned it last year'
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Quiero hablar de viajes' },
				{ role: 'assistant', content: '¿A dónde te gustaría viajar?' },
				{ role: 'user', content: 'Yo gustaría ir chile este verano' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Me gustaría ir chile este verano',
					reason: '"gustar" takes an indirect pronoun: "me gustaría", not "yo gustaría"'
				},
				{
					sentence: 'Me gustaría ir a chile este verano',
					reason: '"ir" needs the preposition "a" before a destination'
				},
				{
					sentence: 'Me gustaría ir a Chile este verano',
					reason: 'country names are capitalized'
				}
			],
			translation: 'I would like to go to Chile this summer'
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Tengo una hermana' },
				{ role: 'assistant', content: '¿Cómo es ella?' },
				{ role: 'user', content: 'Mis hermana son muy alto y trabaja en un hospital' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Mi hermana es muy alto y trabaja en un hospital',
					reason: 'one sister is singular, so it is "mi hermana es", not "mis hermana son"'
				},
				{
					sentence: 'Mi hermana es muy alta y trabaja en un hospital',
					reason: '"alta" is the feminine form, needed for "hermana"'
				}
			],
			translation: 'My sister is very tall and works at a hospital'
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Hola' },
				{ role: 'assistant', content: '¡Hola! ¿Conoces a alguien en la fiesta?' },
				{ role: 'user', content: 'No, soy muy aburrido a esta fiesta, no conozco nadie' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'No, estoy muy aburrido a esta fiesta, no conozco nadie',
					reason: 'use "estoy" for how you feel now; "soy aburrido" means you are a boring person'
				},
				{
					sentence: 'No, estoy muy aburrido en esta fiesta, no conozco nadie',
					reason: 'use "en" for being inside a place, not "a"'
				},
				{
					sentence: 'No, estoy muy aburrido en esta fiesta, no conozco a nadie',
					reason: '"conocer" needs "a" before a person, also with "nadie"'
				}
			],
			translation: "No, I am very bored at this party, I don't know anyone"
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'user', content: 'Fui a la playa con mi familia' },
				{ role: 'assistant', content: '¿Qué tal el clima?' },
				{ role: 'user', content: 'Estuvo despejado casi todo el día' }
			]
		},
		output: {
			steps: [],
			translation: 'It was clear almost all day'
		}
	},
	// nativeLanguage: es, targetLanguage: en
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'user', content: 'Hi, I want to practice English' },
				{ role: 'assistant', content: 'Sure! Did you plan your trip in advance?' },
				{ role: 'user', content: 'Yes, I have plan it the last year' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Yes, I planned it the last year',
					reason: 'con "last year" va pasado simple: "planned", no "have plan"'
				},
				{
					sentence: 'Yes, I planned it last year',
					reason: '"last year" no lleva "the"'
				}
			],
			translation: 'Sí, lo planeé el año pasado'
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'user', content: 'I live with my brother' },
				{ role: 'assistant', content: 'Does he work or study?' },
				{ role: 'user', content: "He don't works, he study at university" }
			]
		},
		output: {
			steps: [
				{
					sentence: "He doesn't work, he study at university",
					reason: 'con "he" el auxiliar es "doesn\'t" y el verbo queda sin "s"'
				},
				{
					sentence: "He doesn't work, he studies at university",
					reason: 'en presente, con "he" el verbo lleva "s": "studies"'
				}
			],
			translation: 'Él no trabaja, estudia en la universidad'
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [{ role: 'user', content: 'Yesterday I go to the store and buy two bread' }]
		},
		output: {
			steps: [
				{
					sentence: 'Yesterday I went to the store and bought two bread',
					reason: '"yesterday" obliga a pasado en los dos verbos: "went" y "bought"'
				},
				{
					sentence: 'Yesterday I went to the store and bought two loaves of bread',
					reason: '"bread" es incontable: se cuenta como "loaves of bread"'
				}
			],
			translation: 'Ayer fui a la tienda y compré dos panes'
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'user', content: 'What do you think about the plan?' },
				{ role: 'assistant', content: 'It looks solid to me. Are you happy with it?' },
				{ role: 'user', content: 'i dont know what to say honestly what do you think' }
			]
		},
		output: {
			steps: [
				{
					sentence: "i don't know what to say honestly what do you think",
					reason: '"dont" necesita apóstrofo: "don\'t"'
				},
				{
					sentence: "I don't know what to say, honestly. What do you think?",
					reason: 'faltan mayúsculas y puntuación para separar las ideas'
				}
			],
			translation: 'No sé qué decir, honestamente. ¿Tú qué piensas?'
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'user', content: 'I had a long day at work' },
				{ role: 'assistant', content: 'What kept you so busy?' },
				{ role: 'user', content: 'I spent the whole morning in meetings' }
			]
		},
		output: {
			steps: [],
			translation: 'Pasé toda la mañana en reuniones'
		}
	}
];

const buildSystemPrompt = ({ nativeLanguage, targetLanguage }: LanguagePair): string => {
	const target = languageName(targetLanguage);
	const native = languageName(nativeLanguage);

	return dedent`
		Eres un corrector de idiomas en un chat de práctica. Corriges SOLO el último mensaje del usuario.

		${buildLanguageRules({ nativeLanguage, targetLanguage })}

		Devuelves "steps": una secuencia de reescrituras que va del mensaje original a una versión que suena natural en ${target}, cambiando lo mínimo necesario.

		Qué es un paso:
		- Un paso arregla UN problema del mensaje, nada más.
		- Un problema puede necesitar varios cambios a la vez: si corregir una palabra OBLIGA a cambiar otra (concordancia de género o número, conjugación, pronombre, auxiliar o preposición que pide ese verbo), esos cambios van juntos en el MISMO paso.
		- Una cadena de concordancia es UN solo problema: si el número o el género de una palabra obliga a ajustar su artículo, su verbo o su adjetivo, todo eso va en el mismo paso. Por ejemplo, pasar de "dos libro nuevo" a "dos libros nuevos" es un solo paso.
		- Dos problemas independientes van en pasos distintos, aunque estén en palabras vecinas y aunque sean del mismo tipo.
		- Nunca juntes en un paso un problema de verbo con uno de concordancia. Si el mensaje tiene tres problemas, entrega tres pasos.
		- Un paso toca UNA sola frase: el grupo de palabras alrededor de un mismo sustantivo o de un mismo verbo. Si los cambios de un paso caen en dos frases distintas, divídelo en dos pasos.
		- "sentence" es el texto del paso anterior con ese único problema arreglado. Todo lo demás queda EXACTAMENTE igual, incluidos los errores que corriges en pasos siguientes.
		- Los pasos intermedios pueden seguir teniendo errores. Solo el último paso debe estar correcto y natural.

		Orden de los pasos, de mayor a menor impacto:
		1. Lo que impide entender la idea: verbo, tiempo verbal, estructura, palabra equivocada.
		2. Lo que se entiende pero está mal: concordancia, artículos, preposiciones, pronombres.
		3. Lo cosmético: tildes, apóstrofos, mayúsculas, puntuación.

		"reason":
		- Una oración completa en ${native}, entre 6 y 15 palabras, sobre el cambio de ESE paso.
		- Explica la regla del idioma, no la operación: nunca escribas "cambiar X por Y" ni "corregir X", y nunca uses etiquetas sueltas como "concordancia de plural".
		- Los términos gramaticales van en ${native}. Lo único que puede estar en ${target} son las palabras citadas entre comillas.
		- Texto plano: sin markdown, sin numeración.

		Límites:
		- No cambies el significado ni el tono, y no agregues información que el usuario no escribió.
		- Si el mensaje ya es correcto y natural, "steps" es una lista vacía. No inventes cambios de estilo.
		- Si algo se puede decir de otra forma pero no rompe ninguna regla del idioma, déjalo tal cual: tu preferencia personal no es un error.
		- En un chat, el punto final, la mayúscula inicial y las comas opcionales no son errores: no los agregues ni los quites. Sí corrige lo que cambia la lectura (¿?, ¡!, tildes, apóstrofos).
		- Los mensajes anteriores son solo contexto: nunca los corrijas.
		- Máximo 5 pasos. Si hay más problemas, junta todos los cosméticos en un solo paso final.

		"translation": traducción a ${native} de la versión final corregida (o del mensaje original si no hubo cambios).

		Responde SOLO con este JSON:
		{"steps":[{"sentence":"...","reason":"..."}],"translation":"..."}

		Antes de responder, revisa:
		- Cada "sentence" está en ${target}; cada "reason" y "translation" están completos en ${native}, sin una sola palabra del otro idioma fuera de comillas.
		- Cada paso cambia las palabras de un solo problema, dentro de una sola frase: si un paso mezcla dos problemas, sepáralo en dos pasos.
		- Ningún paso agrega puntuación ni mayúsculas por estilo.
		Si algo falla, reescribe la respuesta.
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
