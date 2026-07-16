export type LCSOperation = { type: 'equal' | 'delete' | 'insert'; token: string };

export function lcs(a: string[], b: string[]): LCSOperation[] {
	const n = a.length;
	const m = b.length;
	const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));

	for (let i = n - 1; i >= 0; i--) {
		for (let j = m - 1; j >= 0; j--) {
			lcs[i][j] = a[i] === b[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
		}
	}

	const operations: LCSOperation[] = [];
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
