import type { PromptFn } from './utils';
import z from 'zod';
import type { LANGUAGES } from '$lib/constants';
import dedent from 'dedent';

export const translationFeedbackSchema = z.object({
	tips: z.array(z.string().min(1))
});

export type LLMTranslationFeedback = z.infer<typeof translationFeedbackSchema>;

export const prompts: PromptFn<
	{ original: string; expected: string; answer: string },
	{ nativeLanguage: (typeof LANGUAGES)[number]; targetLanguage: (typeof LANGUAGES)[number] }
> = (input, options) => {
	return [
		{
			role: 'system',
			content: dedent`
                Actúa como tutor breve de idiomas.

                Tarea:
                - Explicar brevemente qué debe cambiar para acercarse a la respuesta esperada.

                Contexto:
                - Idioma nativo del usuario: ${options.nativeLanguage}
                - Idioma objetivo: ${options.targetLanguage}

                Entrada:
                - original: frase o contexto original.
                - expected: respuesta esperada exacta.
                - answer: respuesta del usuario.

                Formato de respuesta (OBLIGATORIO):

                {
                    "tips": string[]
                }
                
                Reglas:
                - Máximo 3 tips.
                - Cada tip debe ser breve y claro.
                - Escribe los tips en el idioma nativo del usuario: ${options.nativeLanguage}.
                - Enfócate en los errores más importantes.
                - Puedes incluir pequeñas frases en el idioma objetivo: ${options.targetLanguage}.
                `
		},
		{
			role: 'user',
			content: dedent`
                original: "Quiero comer"
                expected: "I want to eat"
                answer: "I want eat"
            `
		},
		{
			role: 'assistant',
			content: dedent`
                {
                    "tips": [
                        "\"want\" needs \"to\" before another verb: \"want to eat\".",
                        "In English, verb + verb usually requires \"to\" (e.g., \"want to go\", \"need to study\")."
                    ]
                }
            `
		},
		{
			role: 'user',
			content: dedent`
                original: "Voy al trabajo"
                expected: "I go to work"
                answer: "I am going to work"
            `
		},
		{
			role: 'assistant',
			content: dedent`
                {
                    "tips": [
                        "The expected answer uses present simple: \"I go to work\".",
                        "\"I am going\" is present continuous and changes the meaning.",
                        "Match the exact tense used in the expected translation."
                    ]
                }
            `
		},
		{
			role: 'user',
			content: dedent`
                original: "Quisiera un café"
                expected: "Je voudrais un café"
                answer: "Je veux un café"
            `
		},
		{
			role: 'assistant',
			content: dedent`
                {
                    "tips": [
                        "\"voudrais\" is conditional — more polite than \"veux\".",
                        "\"Je veux\" sounds direct; use \"Je voudrais\" for requests.",
                        "Politeness matters in French requests."
                    ]
                }
            `
		},
		{
			role: 'user',
			content: dedent`
                original: "${input.original}"
                expected: "${input.expected}"
                answer: "${input.answer}"
            `
		}
	];
};
