import { fail } from '@sveltejs/kit';

/** Returns a typed action failure that satisfies FormResultContract. */
export function formFail<Id extends string, Code extends string>({
	id,
	code,
	status = 400
}: {
	id: Id;
	code: Code;
	status: number;
}) {
	return fail(status, { id, kind: 'failure' as const, code });
}

/** Returns a typed action success that satisfies FormResultContract. */
export function formOk<
	Id extends string,
	Data extends Record<string, unknown> | undefined = undefined
>({ id, data }: { id: Id; data?: Data }) {
	return data === undefined
		? ({ id, kind: 'success' as const } as const)
		: ({ id, kind: 'success' as const, data } as const);
}
