import type {
	ChatCompletionAssistantMessageParam,
	ChatCompletionUserMessageParam
} from 'groq-sdk/resources/chat.js';
import { LANGUAGE_CODE_LABELS, LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';
import * as z from 'zod';
import type { ChatCompletionSystemMessageParam } from 'groq-sdk/resources/chat.mjs';

export const inputSchema = z.object({
	nativeLanguage: z.enum(LANGUAGE_CODES),
	targetLanguage: z.enum(LANGUAGE_CODES),
	turns: z.array(z.object({ role: z.enum(['assistant', 'user']), content: z.string() }))
});

export const outputSchema = z.object({
	steps: z.array(z.object({ sentence: z.string().min(1), reason: z.string().min(1) })),
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
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿A dónde te gustaría viajar?' },
				{ role: 'user', content: 'Yo gustaría ir chile este verano' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Me gustaría ir chile este verano',
					reason: '"gustar" is used differently in Spanish, you need "me" instead of "yo"'
				},
				{
					sentence: 'Me gustaría ir a chile este verano',
					reason: 'missing the preposition "a" before a place'
				},
				{ sentence: 'Me gustaría ir a Chile este verano', reason: 'country names are capitalized' }
			],
			translation: 'I would like to go to Chile this summer'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Llegas a la hora?' },
				{ role: 'user', content: 'Me olvido decir voy llegar tarde' }
			]
		},
		output: {
			steps: [
				{ sentence: 'Me olvidó decir voy llegar tarde', reason: 'wrong verb tense' },
				{
					sentence: 'Se me olvidó decir voy llegar tarde',
					reason: '"olvidarse" needs "se" in this reflexive construction'
				},
				{
					sentence: 'Se me olvidó decir que voy llegar tarde',
					reason: 'missing "que" to connect the two clauses'
				},
				{
					sentence: 'Se me olvidó decir que voy a llegar tarde',
					reason: 'missing "a" before the infinitive to express near future'
				}
			],
			translation: 'I forgot to say that I will arrive late'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Qué hiciste el fin de semana?' },
				{ role: 'user', content: 'Fui a la playa con mi familia' }
			]
		},
		output: {
			steps: [],
			translation: 'I went to the beach with my family'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Cómo te fue en el examen?' },
				{ role: 'user', content: 'Me fue bien, pero fue muy dificil' }
			]
		},
		output: {
			steps: [{ sentence: 'Me fue bien, pero fue muy difícil', reason: 'missing accent mark' }],
			translation: 'I did well, but it was very difficult'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Qué sueles hacer?' },
				{ role: 'user', content: 'Voy en el gimnasio los lunes y los miércoles' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Voy al gimnasio los lunes y los miércoles',
					reason: 'use "al" (a + el) instead of "en" when talking about going to a place'
				}
			],
			translation: 'I go to the gym on Mondays and Wednesdays'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Qué piensas del plan?' },
				{ role: 'user', content: 'Bueno no se que decirte la verdad que opinas tu' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Bueno no sé qué decirte la verdad qué opinas tú',
					reason: 'missing accent marks on "sé", "qué" and "tú"'
				},
				{
					sentence: 'Bueno, no sé qué decirte, la verdad. ¿Qué opinas tú?',
					reason: 'missing punctuation to separate ideas and mark the question'
				}
			],
			translation: 'Well, I do not know what to tell you. What do you think?'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Te estás divirtiendo?' },
				{ role: 'user', content: 'Soy muy aburrido a esta fiesta, conocer nadie aquí' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Estoy muy aburrido a esta fiesta, conocer nadie aquí',
					reason: 'use "estoy" instead of "soy" for a temporary feeling'
				},
				{
					sentence: 'Estoy muy aburrido en esta fiesta, conocer nadie aquí',
					reason: 'use "en" instead of "a" when talking about being inside a place'
				},
				{
					sentence: 'Estoy muy aburrido en esta fiesta, no conozco a nadie aquí',
					reason: 'the verb needs to be conjugated and paired with "no...a nadie"'
				}
			],
			translation: 'I am very bored at this party, I do not know anyone here'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Quién te contó la noticia?' },
				{ role: 'user', content: 'Lo me dijo ayer a la reunión' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Me lo dijo ayer a la reunión',
					reason: 'object pronouns "me" and "lo" go in this order before the verb'
				},
				{
					sentence: 'Me lo dijo ayer en la reunión',
					reason: 'use "en" instead of "a" when talking about being inside an event'
				}
			],
			translation: 'He/She told me yesterday at the meeting'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{
					role: 'assistant',
					content: '¿Qué región te interesa más, la Patagonia, el norte o el centro?'
				},
				{ role: 'user', content: 'Patagonia gustar mas, muchas opinión positiva' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'La Patagonia gustar mas, muchas opinión positiva',
					reason: 'place names usually need an article'
				},
				{
					sentence: 'La Patagonia me gusta mas, muchas opinión positiva',
					reason: '"gustar" needs to be conjugated with "me"'
				},
				{
					sentence: 'La Patagonia me gusta más, muchas opinión positiva',
					reason: 'missing accent mark on "más"'
				},
				{
					sentence: 'La Patagonia me gusta más, hay muchas opiniones positivas',
					reason: 'missing verb and plural agreement'
				}
			],
			translation: 'I like Patagonia the most, there are many positive opinions'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			turns: [
				{ role: 'assistant', content: '¿Qué lugares de Chile te interesan?' },
				{ role: 'user', content: 'Honesto, no saber, yo conozco poco país.' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Honestamente, no saber, yo conozco poco país.',
					reason: '"honesto" is an adjective, you need the adverb "honestamente" here'
				},
				{
					sentence: 'Honestamente, no sé, yo conozco poco país.',
					reason: '"saber" needs to be conjugated as "sé"'
				},
				{
					sentence: 'Honestamente, no sé, yo conozco poco el país.',
					reason: 'missing the article "el" before "país"'
				},
				{
					sentence: 'Honestamente, no sé, conozco poco el país.',
					reason: 'the pronoun "yo" is unnecessary here'
				}
			],
			translation: "Honestly, I don't know, I know little about the country."
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'assistant', content: 'What are your plans for tomorrow?' },
				{ role: 'user', content: 'I will go to work and after I go to gym with my friend' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'I will go to work and after I go to the gym with my friend',
					reason: 'falta el artículo "the" antes de "gym"'
				},
				{
					sentence: 'I will go to work and after that I will go to the gym with my friend',
					reason: '"after" solo no suena natural para conectar dos acciones futuras'
				}
			],
			translation: 'Iré a trabajar y después iré al gimnasio con mi amigo'
		}
	}),
	...buildFewShot({
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			turns: [
				{ role: 'assistant', content: 'Have you ever traveled abroad?' },
				{ role: 'user', content: 'Yes, I have went to Peru last year' }
			]
		},
		output: {
			steps: [
				{
					sentence: 'Yes, I went to Peru last year',
					reason: 'con una fecha específica ("last year") se usa pasado simple, no "have went"'
				}
			],
			translation: 'Sí, fui a Perú el año pasado'
		}
	})
];

export const buildPrompt = (
	input: z.infer<typeof inputSchema>
): (
	| ChatCompletionSystemMessageParam
	| ChatCompletionUserMessageParam
	| ChatCompletionAssistantMessageParam
)[] => {
	return [
		{
			role: 'system',
			// v0.1
			// content: dedent`
			// 	Recibirás un historial de mensajes en un idioma objetivo "targetLanguage", escritos por alguien cuyo idioma nativo es "nativeLanguage".
			// 	Tu tarea es corregir solo el último mensaje del historial, con el mínimo de cambios para que suene natural en el idioma objetivo.

			// 	Divide la corrección en "steps": cada "step" es una versión del mensaje un poco más corregida que la anterior, hasta llegar a una versión completamente natural.
			// 	Cada "step" corrige errores de un mismo tipo. Ordena los steps del error más importante (afecta el significado) al más superficial (tildes, ortografía, puntuación).

			// 	"reason" es una explicación breve, en "nativeLanguage", de qué se corrigió en ese step (ej: "faltaba la preposición 'a'"). No uses categorías ni códigos, solo una frase corta y clara.

			// 	Reglas:
			// 	- Si el mismo error aparece más de una vez en la frase, corrígelo todo en un solo step, no lo repitas en steps distintos.
			// 	- Si el mensaje ya es correcto, "steps" debe estar vacío.
			// 	- No agregues cambios de estilo que no sean errores reales.

			// 	Salida JSON:

			// 	{
			// 		"steps": [{ "sentence": "...", "reason": "..." }]
			// 	}
			// `
			// v0.2
			// content: dedent`
			// 	Recibirás un historial de mensajes en un idioma objetivo "targetLanguage", escritos por alguien cuyo idioma nativo es "nativeLanguage".
			// 	Tu tarea es corregir solo el último mensaje del historial, con el mínimo de cambios para que suene natural en el idioma objetivo.

			// 	La corrección es una secuencia de "steps". Cada "step" se construye corrigiendo el "step" INMEDIATAMENTE ANTERIOR, no el mensaje original:
			// 	- steps[0] corrige el mensaje original.
			// 	- steps[n] corrige steps[n-1] (no el mensaje original).
			// 	- El texto de steps[n] debe ser igual al de steps[n-1], excepto por los cambios de ese step. No reintroduzcas ni cambies nada que ya haya quedado corregido en un step anterior.
			// 	- El último step es la versión completamente natural del mensaje.

			// 	Cada "step" corrige errores de un mismo tipo. Ordena los steps del error más importante (afecta el significado) al más superficial (tildes, ortografía, puntuación).

			// 	Reglas:
			// 	- Si el mismo error aparece más de una vez en la frase, corrígelo todo en un solo step, no lo repitas en steps distintos.
			// 	- Si el mensaje ya es correcto, "steps" debe estar vacío.
			// 	- No agregues cambios de estilo que no sean errores reales.

			// 	Salida JSON:

			// 	{
			// 		"steps": [{ "sentence": "...", "reason": "..." }]
			// 	}
			// `
			// v0.3
			// content: dedent`
			// 	Recibirás un historial de mensajes en un idioma objetivo "targetLanguage", escritos por alguien cuyo idioma nativo es "nativeLanguage".
			// 	Tu tarea es corregir solo el último mensaje del historial, con el mínimo de cambios para que suene natural en el idioma objetivo "targetLanguage".

			// 	La corrección es una secuencia de "steps". Cada "step" corrige errores de un mismo tipo y están ordenados por importancia (afectan el significado), así:
			// 	- steps[0] corrige los errores más críticos (de la misma categoría) del mensaje original.
			// 	- steps[1] corrige los segundos errores más críticos (de la misma categoría) de steps[0].
			// 	- steps[2] corrige los terceros errores más críticos (de la misma categoría) de steps[1], y así sucesivamente.
			// 	- El último "step" corrige los últimos errores más críticos (de la misma categoría) del penúltimo "step", dando lugar a un mensaje completamente corregido y natural, con el mínimo de cambios.

			// 	Cada "step" está acompañado de un "reason" escrito en "nativeLanguage" que describe la razón del cambio de manera breve.
			// 	Una categoría de error es única entre todos los "steps".

			// 	Reglas:
			// 	- Si el mensaje ya es correcto, "steps" debe ser una lista vacía.
			// 	- No agregues cambios de estilo que no sean errores reales.
			// 	- "reason" justifica brevemente el cambio (en el idioma "nativeLanguage").
			// 	- "translation" es la traducción del mensaje (en el idioma nativo "nativeLanguage").

			// 	Salida JSON (obligatoria):
			// 	{
			// 		"steps": [{ "sentence": "...", "reason": "..." }],
			// 		"translation": "..."
			// 	}
			// `
			// v0.4 (no funciona bien)
			// content: dedent`
			// 	Recibirás un historial de mensajes en un idioma objetivo "targetLanguage", escritos por alguien cuyo idioma nativo es "nativeLanguage".
			// 	Tu tarea es corregir solo el último mensaje del historial, con el mínimo de cambios para que suene natural en el idioma objetivo "targetLanguage".

			// 	La corrección es una secuencia de "steps", ordenados del error más importante (afecta el significado) al más superficial (tildes, ortografía, puntuación). Cada "step" corrige una única categoría de error, distinta a la de cualquier otro step.
			// 	- steps[0] corrige el mensaje original.
			// 	- steps[n] (n > 0) corrige steps[n-1], no el mensaje original.
			// 	- El texto de steps[n] debe ser idéntico al de steps[n-1] excepto por el cambio de ese step.
			// 	- El último step es el mensaje completamente corregido y natural.

			// 	Cada "step" está acompañado de un "reason" escrito en "nativeLanguage" que describe la razón del cambio de manera breve.
			// 	Una categoría de error es única entre todos los "steps".

			// 	Reglas:
			// 	- Si el mensaje ya es correcto, "steps" debe ser una lista vacía.
			// 	- No agregues cambios de estilo que no sean errores reales.
			// 	- Entrega un "reason" breve que describa el error en el idioma nativo "nativeLanguage".
			// 	- "translation" es la traducción del mensaje en el idioma nativo "nativeLanguage".

			// 	Salida JSON (obligatoria):
			// 	{
			// 		"steps": [{ "sentence": "...", "reason": "..." }],
			// 		"translation": "..."
			// 	}
			// `
			//v0.5
			content: dedent`
				Recibirás un historial de mensajes en un idioma objetivo "targetLanguage", escritos por alguien cuyo idioma nativo es "nativeLanguage".
				Tu tarea es corregir solo el último mensaje del historial, con el mínimo de cambios para que suene natural en el idioma objetivo "targetLanguage".

				Pasos para corregir:
				1. Recorre la oración de izquierda a derecha e identifica cada error individual, en el orden en que aparecen.
				2. Agrupa un error con el siguiente en el mismo "step" SOLO si corregir el primero obliga a cambiar cómo se corrige el segundo (dependencia gramatical: concordancia, conjugación, pronombre que cambia por el sujeto, etc.). Si dos errores son independientes, aunque estén cerca, van en steps distintos.
				3. Cada "step" aplica su corrección sobre el resultado del step anterior (no sobre el mensaje original).
				4. Escribe un "reason" en "nativeLanguage" que explique exactamente el cambio de ese step, ni más ni menos.
				5. Repite hasta que la oración esté completamente corregida y suene natural.

				Reglas:
				- Si el mensaje ya es correcto, "steps" debe ser una lista vacía.
				- No agregues cambios de estilo que no sean errores reales.
				- "translation" es la traducción del mensaje (en el idioma nativo "nativeLanguage").

				Salida JSON (obligatoria):
				{
					"steps": [{ "sentence": "...", "reason": "..." }],
					"translation": "..."
				}
			`
		},
		...fewShots,
		...buildFewShot({
			input
		})
	];
};
