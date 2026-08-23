import { LANGUAGE_CODES } from '$lib/constants';
import { feedbackPatternSchema } from '$lib/feedback/feedback-payload';
import * as z from 'zod';
import dedent from 'dedent';
import type {
	ChatCompletionUserMessageParam,
	ChatCompletionAssistantMessageParam,
	ChatCompletionSystemMessageParam
} from 'groq-sdk/resources/chat.js';
import { buildLanguageRules, languageName, selectExamples, type LanguagePair } from './utils';

export const inputSchema = z
	.object({
		nativeLanguage: z.enum(LANGUAGE_CODES),
		targetLanguage: z.enum(LANGUAGE_CODES),
		mistakes: z
			.array(
				z.object({
					wrote: z.string().min(1),
					instead: z.string().min(1),
					note: z.string().nullable()
				})
			)
			.min(1)
	})
	.refine(({ nativeLanguage, targetLanguage, mistakes }) => {
		return (
			nativeLanguage !== targetLanguage && mistakes.every(({ wrote, instead }) => wrote !== instead)
		);
	});

export const outputSchema = z.object({
	patterns: z.array(feedbackPatternSchema).min(1).max(3)
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
				writePatternsIn: languageName(input.nativeLanguage),
				mistakes: input.mistakes
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
			mistakes: [
				{
					wrote: 'I want go to the park',
					instead: 'I want to go to the park',
					note: 'Después de "want" el otro verbo lleva "to".'
				},
				{
					wrote: 'I want eat now',
					instead: 'I want to eat now',
					note: 'Falta "to" después de "want".'
				},
				{
					wrote: 'Yesterday I go to the store',
					instead: 'Yesterday I went to the store',
					note: '"yesterday" obliga a pasado: "went".'
				}
			]
		},
		output: {
			patterns: [
				{
					what: 'Te comes el "to" después de "want"',
					why: 'En español dices "quiero ir" sin nada entre los verbos, y lo calcas.',
					how: 'Cada vez que digas "want" más un verbo, mete "to" en el medio.',
					soundsLike: 'Un nativo oye "quiero una cosa llamada go", no "quiero ir".',
					examples: [
						{ wrote: 'I want go to the park', instead: 'I want to go to the park' },
						{ wrote: 'I want eat now', instead: 'I want to eat now' }
					]
				},
				{
					what: 'Dejas el verbo en presente aunque la frase ya es pasado',
					why: 'En español "ayer" carga el tiempo y el verbo a veces se siente igual.',
					how: 'Si aparece "yesterday" o "ago", conjuga el verbo en pasado.',
					soundsLike: 'Suena a que sigues yendo ahora, no a que ya fuiste.',
					examples: [
						{ wrote: 'Yesterday I go to the store', instead: 'Yesterday I went to the store' }
					]
				}
			]
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			mistakes: [
				{
					wrote: 'I am going to work every day',
					instead: 'I go to work every day',
					note: 'Para una rutina se usa presente simple: "I go".'
				},
				{
					wrote: "He don't works, he study at university",
					instead: "He doesn't work, he studies at university",
					note: 'Con "he" el auxiliar es "doesn\'t" y el verbo lleva "s".'
				}
			]
		},
		output: {
			patterns: [
				{
					what: 'Usas "am going" para algo que haces siempre',
					why: 'En español un solo presente cubre hábito y ahora; en inglés se parten.',
					how: 'Si es rutina, usa presente simple: "I go", no "I am going".',
					soundsLike: 'Suena a que hoy vas camino al trabajo, no a que es tu costumbre.',
					examples: [{ wrote: 'I am going to work every day', instead: 'I go to work every day' }]
				},
				{
					what: 'Con "he" dejas el verbo como si fuera "I"',
					why: 'En español el verbo cambia poco; calcas esa forma plana al inglés.',
					how: 'Con he/she/it: "doesn\'t" más verbo pelado, o verbo más "s".',
					soundsLike: '"He don\'t" suena a niño chico o a alguien que recién empieza.',
					examples: [
						{
							wrote: "He don't works, he study at university",
							instead: "He doesn't work, he studies at university"
						}
					]
				}
			]
		}
	},
	{
		input: {
			nativeLanguage: 'es',
			targetLanguage: 'en',
			mistakes: [
				{
					wrote: 'I have finish the work yesterday',
					instead: 'I finished the work yesterday',
					note: '"yesterday" pide pasado simple: "finished", no "have finish".'
				},
				{
					wrote: 'He have two brothers',
					instead: 'He has two brothers',
					note: 'Con "he" el verbo es "has", no "have".'
				}
			]
		},
		output: {
			patterns: [
				{
					what: 'Dejas "have" + verbo cuando la frase ya es pasado',
					why: 'Mezclas el "have" de presente perfecto con el pasado de "ayer".',
					how: 'Si está "yesterday", usa pasado simple: "finished". Quita el "have".',
					soundsLike: '"I have finish yesterday" suena a que no sabes si ya terminó o no.',
					examples: [
						{
							wrote: 'I have finish the work yesterday',
							instead: 'I finished the work yesterday'
						}
					]
				},
				{
					what: 'Con "he" dejas "have" como si fuera "I"',
					why: 'En español "tiene" cambia poco respecto de "tengo"; calcas "have" para todos.',
					how: 'Con he/she/it en presente: "has", nunca "have".',
					soundsLike: '"He have two brothers" suena a niño que recién empieza.',
					examples: [{ wrote: 'He have two brothers', instead: 'He has two brothers' }]
				}
			]
		}
	},
	// nativeLanguage: en, targetLanguage: es
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			mistakes: [
				{
					wrote: 'Voy a gimnasio',
					instead: 'Voy al gimnasio',
					note: '"gimnasio" needs the article: "a" + "el" becomes "al gimnasio".'
				},
				{
					wrote: 'Fui a supermercado',
					instead: 'Fui al supermercado',
					note: 'Use "al" before a masculine place you have in mind.'
				},
				{
					wrote: 'Me lo dijo a la reunión',
					instead: 'Me lo dijo en la reunión',
					note: 'Use "en" for being inside an event, not "a".'
				}
			]
		},
		output: {
			patterns: [
				{
					what: 'You drop the article before everyday places',
					why: 'English often skips "the" with "gym" or "school"; Spanish usually keeps it.',
					how: 'If you can picture that place, say "al" or "a la", not bare "a".',
					soundsLike: '"Voy a gimnasio" sounds like "I go to gym": unfinished, not the gym.',
					examples: [
						{ wrote: 'Voy a gimnasio', instead: 'Voy al gimnasio' },
						{ wrote: 'Fui a supermercado', instead: 'Fui al supermercado' }
					]
				},
				{
					what: 'You use "a" when you mean you were inside something',
					why: 'English "at the meeting" maps in your head to "a", but Spanish wants "en".',
					how: 'If it happened during the event, say "en la reunión", not "a".',
					soundsLike: '"Dijo a la reunión" sounds like you spoke to the meeting, not at it.',
					examples: [{ wrote: 'Me lo dijo a la reunión', instead: 'Me lo dijo en la reunión' }]
				}
			]
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			mistakes: [
				{
					wrote: 'Voy chile en enero',
					instead: 'Voy a Chile en enero',
					note: '"ir" needs "a" before a country.'
				},
				{
					wrote: 'Llegué madrid anoche',
					instead: 'Llegué a Madrid anoche',
					note: '"llegar" needs "a" before a city.'
				},
				{
					wrote: 'Ayer yo comer pizza',
					instead: 'Ayer yo comí pizza',
					note: 'Need the past tense "comí", not the infinitive.'
				}
			]
		},
		output: {
			patterns: [
				{
					what: 'You drop "a" before a place you go to',
					why: 'English "go Chile" already feels complete, so you skip the Spanish "a".',
					how: 'Before a city or country you go to, put "a": "a Chile", "a Madrid".',
					soundsLike: '"Voy chile" sounds like Chile is a verb, not a destination.',
					examples: [
						{ wrote: 'Voy chile en enero', instead: 'Voy a Chile en enero' },
						{ wrote: 'Llegué madrid anoche', instead: 'Llegué a Madrid anoche' }
					]
				},
				{
					what: 'You leave the verb in the infinitive instead of conjugating',
					why: 'English "eat" looks like a base form, so you paste "comer" as-is.',
					how: 'Pick a tense and conjugate: "comí". Never leave "comer" as the verb.',
					soundsLike: '"Yo comer" sounds like reading a menu, not telling what you did.',
					examples: [{ wrote: 'Ayer yo comer pizza', instead: 'Ayer yo comí pizza' }]
				}
			]
		}
	},
	{
		input: {
			nativeLanguage: 'en',
			targetLanguage: 'es',
			mistakes: [
				{
					wrote: 'Vi la problema ayer',
					instead: 'Vi el problema ayer',
					note: '"problema" is masculine: "el problema".'
				},
				{
					wrote: 'Mi amigo es muy alta',
					instead: 'Mi amigo es muy alto',
					note: '"amigo" is masculine, so the adjective is "alto".'
				},
				{
					wrote: 'Estoy a la oficina',
					instead: 'Estoy en la oficina',
					note: 'Use "en" for being inside a place, not "a".'
				}
			]
		},
		output: {
			patterns: [
				{
					what: 'You guess the article as "la" when the noun is masculine',
					why: 'English "the" never changes, so you default to "la".',
					how: 'If the noun is masculine, even if it ends in -a, use "el": "el problema".',
					soundsLike: '"La problema" sounds like the problem is a woman.',
					examples: [{ wrote: 'Vi la problema ayer', instead: 'Vi el problema ayer' }]
				},
				{
					what: 'You leave the adjective in the other gender',
					why: 'English adjectives never change; you forget they must match the person.',
					how: 'If you talk about "amigo", end the adjective in -o: "alto".',
					soundsLike: '"Amigo ... alta" sounds like you switched to talking about a woman.',
					examples: [{ wrote: 'Mi amigo es muy alta', instead: 'Mi amigo es muy alto' }]
				},
				{
					what: 'You use "a" when you mean you are inside a place',
					why: 'English "at the office" maps in your head to "a".',
					how: 'If you are already there, say "en la oficina", not "a".',
					soundsLike:
						'"Estoy a la oficina" sounds like you are heading toward it, not sitting in it.',
					examples: [{ wrote: 'Estoy a la oficina', instead: 'Estoy en la oficina' }]
				}
			]
		}
	}
];

const buildSystemPrompt = ({ nativeLanguage, targetLanguage }: LanguagePair): string => {
	const target = languageName(targetLanguage);
	const native = languageName(nativeLanguage);

	return dedent`
		Eres un tutor que mira un lote de errores REALES del usuario y nombra los hábitos que se repiten. No das una clase de gramática.

		${buildLanguageRules({ nativeLanguage, targetLanguage })}

		Entrada:
		- mistakes: errores en ${target}. Cada ítem tiene wrote (lo que escribió), instead (la corrección) y note (pista en ${native}).
		- note es ayuda para agrupar; no la cites como si fuera del usuario.

		Salida: "patterns", máximo 3, los hábitos MÁS repetidos o de más impacto. No rellenes hasta 3.

		Cómo agrupar:
		- Dos wrote que cometen el MISMO hueco son UN patrón, aunque las frases sean distintas.
		- No agrupes solo porque dos wrote comparten una palabra ("have", "a", "the"). "I have go yesterday" y "she have a cat" NO son el mismo hábito.
		- Si un wrote tiene varios problemas, no armes un patrón que los liste todos. Quédate con el hábito que comparte con otro item; si no comparte, el de más impacto de ESE wrote.
		- Un what nombra UN hábito. Mal: "infinitivo y plural". Bien: "dejas el verbo en infinitivo".
		- Si para juntar dos wrote necesitas un what vago ("artículos", "concordancia", "gramática"), sepáralos: no son el mismo hábito.
		- Un hábito que aparece una sola vez IGUAL entra si es grave (verbo sin conjugar, tiempo mal). No te quedes solo con lo repetido y dejes fuera el error más gordo.
		- No gastes un patrón en tildes o mayúsculas si hay un hábito más gordo en el lote.

		Cada patrón:
		- what: el hábito visto en wrote, no el nombre de la regla y no un resumen de instead. Mal: "infinitive complement". Bien: "te comes el to después de want". Máximo 12 palabras.
		- why: por qué SU cabeza lo hace (casi siempre calco de ${native}). No repitas what. No expliques lo que oye el nativo.
		- how: UNA instrucción-truco para HOY, no la frase ya corregida. Máximo 18 palabras.
		- soundsLike: qué idea DISTINTA entiende un nativo al oír ESE wrote. Imagen concreta, inventada para esa frase. Cita o parafrasea palabras de ESE wrote; no cueles objetos de otro example (si el wrote habla de gatos, no hables de un auto). Nunca digas que "suena mal", "incorrecto", "roto" o "incompleto". Nunca describas el significado de instead. No recicles una metáfora de los ejemplos si el error es otro.
		- examples: 1 o 2 citas EXACTAS de mistakes. Copia wrote e instead carácter por carácter; si cambias una letra, está mal. Nunca inventes ni parafrasees.

		Orden: primero lo que se repite; si empatan, lo que más cambia el significado.

		Límites:
		- what, why, how, soundsLike en ${native}; lo único en ${target} son palabras entre comillas.
		- Texto plano: sin markdown, sin emojis, sin viñetas.

		Responde SOLO con este JSON:
		{"patterns":[{"what":"...","why":"...","how":"...","soundsLike":"...","examples":[{"wrote":"...","instead":"..."}]}]}

		Antes de responder, revisa:
		- Cada campo de texto está en ${native}, sin palabras de ${target} fuera de comillas.
		- Cada example existe tal cual en mistakes.
		- why habla del aprendiz; soundsLike habla del nativo; no se copian.
		- soundsLike describe el wrote, no la corrección, y no inventa objetos que no están en esa frase.
		- Ningún what junta dos hábitos distintos.
		Si algo falla, reescribe.
	`;
};

export const buildPrompt = (
	raw: z.infer<typeof inputSchema>
): (
	| ChatCompletionSystemMessageParam
	| ChatCompletionUserMessageParam
	| ChatCompletionAssistantMessageParam
)[] => {
	const input = inputSchema.parse(raw);
	return [
		{ role: 'system', content: buildSystemPrompt(input) },
		...selectExamples(examples, input).flatMap((example) => buildFewShot(example)),
		...buildFewShot({ input })
	];
};
