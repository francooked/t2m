import type { LANGUAGE_CODES } from '$lib/constants';
import { diffArrays } from 'diff';
import { tokenize } from './tokenize';

export type Cell = {
	text: string;
	status: 'alive' | 'dead';
	bornRewriteIndex: number | null; // null = original text.
	diedRewriteIndex: number | null; // null = still alive.
};

export type Rewrite = { sentence: string; reason: string };

function applyDifferencesToCells(
	cells: Cell[],
	operations: { added: boolean; removed: boolean; value: string[] }[],
	rewriteIndex: number
): Cell[] {
	const updatedCells: Cell[] = [];
	let index = 0;

	for (const { added, removed, value } of operations) {
		for (const token of value) {
			while (index < cells.length && cells[index].status === 'dead') {
				updatedCells.push(cells[index++]);
			}

			if (added) {
				updatedCells.push({
					text: token,
					status: 'alive',
					bornRewriteIndex: rewriteIndex,
					diedRewriteIndex: null
				});
			} else if (removed) {
				updatedCells.push({ ...cells[index++], status: 'dead', diedRewriteIndex: rewriteIndex });
			} else {
				updatedCells.push(cells[index++]);
			}
		}
	}

	while (index < cells.length) {
		updatedCells.push(cells[index++]);
	}

	return updatedCells;
}

export function buildBlame(
	original: string,
	rewrites: Rewrite[],
	languageCode: (typeof LANGUAGE_CODES)[number]
): Cell[] {
	let cells: Cell[] = tokenize(original, languageCode).map((text) => ({
		text,
		status: 'alive',
		bornRewriteIndex: null,
		diedRewriteIndex: null
	}));

	rewrites.forEach((rewrite, index) => {
		const aliveTexts = cells.filter((cell) => cell.status === 'alive').map((cell) => cell.text);
		const differences = diffArrays(aliveTexts, tokenize(rewrite.sentence, languageCode));
		cells = applyDifferencesToCells(cells, differences, index);
	});

	return cells;
}
