import type { LANGUAGE_CODES } from '$lib/constants';
import { lcs, type LCSOperation } from './lcs';
import { tokenize } from './tokenize';

export type Cell = {
	text: string;
	status: 'alive' | 'dead';
	bornRewriteIndex: number | null; // null = original text.
	diedRewriteIndex: number | null; // null = still alive.
};

export type Rewrite = { sentence: string; reason: string };

function applyLCSOperationsToCells(
	cells: Cell[],
	operations: LCSOperation[],
	rewriteIndex: number
): Cell[] {
	const updatedCells: Cell[] = [];
	let index = 0;

	for (const operation of operations) {
		if (operation.type === 'insert') {
			updatedCells.push({
				text: operation.token,
				status: 'alive',
				bornRewriteIndex: rewriteIndex,
				diedRewriteIndex: null
			});
			continue;
		}

		while (index < cells.length && cells[index].status === 'dead') {
			updatedCells.push(cells[index++]);
		}

		const cell = cells[index++];

		if (operation.type === 'equal') {
			updatedCells.push(cell);
		} else {
			updatedCells.push({ ...cell, status: 'dead', diedRewriteIndex: rewriteIndex });
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
		cells = applyLCSOperationsToCells(
			cells,
			lcs(aliveTexts, tokenize(rewrite.sentence, languageCode)),
			index
		);
	});

	return cells;
}
