export function tokenize(text: string): string[] {
	const regex = /\s+|[\p{L}\p{N}]+|[^\s]/gu;
	const matches = text.matchAll(regex);
	return Array.from(matches).map((match) => match[0]);
}
