export function normalizeText(text: string): string {
	return text
		.normalize('NFC') // Unify accents, diacritics, and other special characters.
		.replace(/\s+/g, ' ') // Replace multiple spaces with a single space.
		.trim(); // Remove leading and trailing spaces.
}
