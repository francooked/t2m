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

const getStringFormValue = (formData: FormData, key: string, defaultValue: string) => {
	const value = formData.get(key);
	if (!value || value instanceof File) return defaultValue;
	return value;
};
