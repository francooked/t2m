import { LANGUAGE_CODE_LABELS, type LANGUAGE_CODES } from '$lib/constants';
import dedent from 'dedent';

export type LanguageCode = (typeof LANGUAGE_CODES)[number];
export type LanguagePair = { nativeLanguage: LanguageCode; targetLanguage: LanguageCode };
export type Turn = { role: 'assistant' | 'user'; content: string };

/** English names keep the language unambiguous for the model, whatever the user's languages are. */
export const languageName = (code: LanguageCode) => LANGUAGE_CODE_LABELS.en[code];

/** Language rules shared by every prompt, so the model never drifts to another language. */
export function buildLanguageRules({ nativeLanguage, targetLanguage }: LanguagePair): string {
	const target = languageName(targetLanguage);
	const native = languageName(nativeLanguage);

	return dedent`
		Idiomas de esta petición (fijos, nunca los cambies):
		- targetLanguage = ${target}: el idioma que el usuario está aprendiendo.
		- nativeLanguage = ${native}: el único idioma en el que el usuario entiende explicaciones.

		Reglas de idioma (obligatorias):
		- Todo texto del idioma objetivo va SOLO en ${target}.
		- Toda explicación o traducción para el usuario va SOLO en ${native}.
		- Nunca mezcles los dos idiomas en una misma frase, salvo palabras citadas entre comillas.
		- Ignora el idioma de estas instrucciones: no es el idioma de tu respuesta.
	`;
}

/** Keeps only the few-shot examples written for the same language pair as the request. */
export function selectExamples<T extends { input: LanguagePair }>(
	examples: T[],
	{ nativeLanguage, targetLanguage }: LanguagePair
): T[] {
	return examples.filter(
		({ input }) =>
			input.nativeLanguage === nativeLanguage && input.targetLanguage === targetLanguage
	);
}

/** Trims the history so a long chat cannot dilute the instructions. */
export function takeLastTurns(turns: Turn[], count: number): Turn[] {
	return turns.slice(-count);
}
