type Correction = {
	start: number;
	end: number;
	reason: string;
	suggestions: { replacement: string }[];
};

type Token =
	| { type: 'text'; content: string }
	| {
			type: 'correction';
			content: string;
			reason: string;
			suggestions: { replacement: string }[];
	  };

export function segmentMessageByCorrections(content: string, corrections: Correction[]): Token[] {
	if (!corrections) return [{ type: 'text', content }];

	let tokens: Token[] = [];
	const sortedCorrections = corrections.toSorted((a, b) => a.start - b.start);

	if (sortedCorrections.length <= 0) {
		tokens.push({ type: 'text', content });
	} else {
		if (sortedCorrections[0].start > 0) {
			tokens.push({ type: 'text', content: content.slice(0, sortedCorrections[0].start) });
		}

		for (let j = 0; j < sortedCorrections.length; j++) {
			if (j > 0) {
				tokens.push({
					type: 'text',
					content: content.slice(
						sortedCorrections[j - 1].end + 1,
						sortedCorrections[j].start - 1 + 1
					)
				});
			}

			tokens.push({
				type: 'correction',
				content: content.slice(sortedCorrections[j].start, sortedCorrections[j].end + 1),
				reason: sortedCorrections[j].reason,
				suggestions: sortedCorrections[j].suggestions
			});
		}

		if (sortedCorrections[sortedCorrections.length - 1].end < content.length - 1) {
			tokens.push({
				type: 'text',
				content: content.slice(
					sortedCorrections[sortedCorrections.length - 1].end + 1,
					content.length
				)
			});
		}
	}

	return tokens;
}
