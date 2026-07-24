import type { LANGUAGE_CODES } from '$lib/constants';

export function tokenize(text: string, languageCode: (typeof LANGUAGE_CODES)[number]): string[] {
	const segmenter = new Intl.Segmenter(languageCode, { granularity: 'word' });
	return Array.from(segmenter.segment(text), ({ segment }) => segment);
}
