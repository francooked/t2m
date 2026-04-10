/**
 * Mimics the result of `Object.keys(...)`.
 *
 * Reference: https://www.reddit.com/r/typescript/comments/14hpz99/comment/jpcrx4g/?utm_source=share&utm_medium=web3x&utm_name=web3xcss&utm_term=1&utm_content=share_button
 * */
export type keysOf<o> = o extends readonly unknown[]
	? number extends o['length']
		? `${number}`
		: keyof o & `${number}`
	: {
			[K in keyof o]: K extends string ? K : K extends number ? `${K}` : never;
		}[keyof o];

export const keysOf = <o extends object>(o: o) => Object.keys(o) as keysOf<o>[];

export function ndjson(data: any) {
	return JSON.stringify(data) + '\n';
}

export function parseNdjson<T>(message: string): T[] | null {
	let output: T[] = [];
	try {
		const lines = message.split('\n');
		for (const line of lines) {
			if (line.trim() === '') break;
			const data: T = JSON.parse(line);
			output.push(data);
		}
		return output;
	} catch {
		return null;
	}
}
