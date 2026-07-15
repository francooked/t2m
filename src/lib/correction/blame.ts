export type Step = { sentence: string; reason: string };

export type Cell = {
	text: string;
	status: 'alive' | 'dead';
	bornStep: number | null; // null = original text
	diedStep: number | null;
};

export type BaseCell = {
	text: string;
	status: 'alive' | 'dead';
};

export type AliveCell = { text: string; status: 'alive'; bornStep: number | null };

export type DeadCell = {
	text: string;
	status: 'dead';
	bornStep: number | null;
	deadStep: number;
	reason: string;
};

export type Segment = {
	text: string;
	kind: 'unchanged' | 'added' | 'removed';
	step: number | null; // índice del step responsable
	reason: string | null;
};

export type Token = { text: string; space: boolean };

type Operation = { type: 'equal' | 'delete' | 'insert'; token: string };

export function tokenize(text: string): string[] {
	const regex = /\s+|[\p{L}\p{N}]+|[^\s]/gu;
	const matches = text.matchAll(regex);
	return Array.from(matches).map((match) => match[0]);
}

function differenceTokens(a: string[], b: string[]): Operation[] {
	const n = a.length;
	const m = b.length;
	const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	const operations: Operation[] = [];
	let i = 0;
	let j = 0;

	while (i < n && j < m) {
		if (a[i] === b[j]) {
			operations.push({ type: 'equal', token: a[i] });
			i++;
			j++;
		} else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
			operations.push({ type: 'delete', token: a[i] });
			i++;
		} else {
			operations.push({ type: 'insert', token: b[j] });
			j++;
		}
	}

	while (i < n) operations.push({ type: 'delete', token: a[i++] });
	while (j < m) operations.push({ type: 'insert', token: b[j++] });

	return operations;
}

function applyOperations(cells: Cell[], operations: Operation[], stepIndex: number): Cell[] {
	const result: Cell[] = [];
	let ptr = 0;

	for (const operation of operations) {
		if (operation.type === 'insert') {
			result.push({ text: operation.token, status: 'alive', bornStep: stepIndex, diedStep: null });
			continue;
		}

		while (ptr < cells.length && cells[ptr].status === 'dead') result.push(cells[ptr++]);

		const cell = cells[ptr++];
		if (operation.type === 'equal') {
			result.push(cell);
		} else {
			result.push({ ...cell, status: 'dead', diedStep: stepIndex });
		}
	}

	while (ptr < cells.length) result.push(cells[ptr++]);

	return result;
}

// Fold hacia adelante: solo mata celdas vivas o inserta nuevas.
export function buildBlame(original: string, steps: Step[]): Cell[] {
	let cells: Cell[] = tokenize(original).map((text) => ({
		text,
		status: 'alive',
		bornStep: null,
		diedStep: null
	}));

	steps.forEach((step, stepIndex) => {
		const aliveTexts = cells.filter((cell) => cell.status === 'alive').map((cell) => cell.text);
		cells = applyOperations(
			cells,
			differenceTokens(aliveTexts, tokenize(step.sentence)),
			stepIndex
		);
	});

	return cells;
}

// Vista global (original → final). Oculta los "fantasmas" (nace y muere entre steps).
export function toGlobalSegments(cells: Cell[], steps: Step[]): Segment[] {
	const segments: Segment[] = [];

	for (const cell of cells) {
		if (cell.status === 'alive') {
			if (cell.bornStep === null) {
				segments.push({ text: cell.text, kind: 'unchanged', step: null, reason: null });
			} else {
				segments.push({
					text: cell.text,
					kind: 'added',
					step: cell.bornStep,
					reason: steps[cell.bornStep].reason
				});
			}
			continue;
		}

		// dead: solo mostramos las que venían del original (no los fantasmas)
		if (cell.bornStep === null && cell.diedStep !== null) {
			segments.push({
				text: cell.text,
				kind: 'removed',
				step: cell.diedStep,
				reason: steps[cell.diedStep].reason
			});
		}
	}

	return segments;
}

// Vista detalle: el diff de cada step contra el anterior, con su razón.
export function toStepDiffs(original: string, steps: Step[]) {
	const sentences = [original, ...steps.map((step) => step.sentence)];
	return steps.map((step, i) => ({
		reason: step.reason,
		ops: differenceTokens(tokenize(sentences[i]), tokenize(sentences[i + 1]))
	}));
}
