import type { Cell, Rewrite } from './build-blame';

export type Segment =
	| {
			text: string;
			kind: 'unchanged';
			rewriteIndex: null;
			reason: null;
	  }
	| { text: string; kind: 'added' | 'removed'; rewriteIndex: number; reason: string };

export function traceRewriteHistory(cells: Cell[], rewrites: Rewrite[]): Segment[] {
	const segments: Segment[] = [];

	for (const cell of cells) {
		if (cell.status === 'alive') {
			if (cell.bornRewriteIndex === null) {
				segments.push({ text: cell.text, kind: 'unchanged', rewriteIndex: null, reason: null });
			} else {
				segments.push({
					text: cell.text,
					kind: 'added',
					rewriteIndex: cell.bornRewriteIndex,
					reason: rewrites[cell.bornRewriteIndex].reason
				});
			}
			continue;
		}

		// New tokens can appear and disappear between steps (aka "ghost tokens"),
		// but they are irrelevant in the corrected text.
		if (cell.bornRewriteIndex === null && cell.diedRewriteIndex !== null) {
			segments.push({
				text: cell.text,
				kind: 'removed',
				rewriteIndex: cell.diedRewriteIndex,
				reason: rewrites[cell.diedRewriteIndex].reason
			});
		}
	}

	return segments;
}
