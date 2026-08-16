import * as z from 'zod';
import { fail } from '@sveltejs/kit';
import type { InferFormResult } from './contract';

export function createFormResponders<
	const Id extends string,
	Success extends z.ZodType,
	Failure extends z.ZodType<{ code: string }>
>({ id, success, failure }: { id: Id; success: Success; failure: Failure }) {
	type Result = InferFormResult<Id, Success, Failure>;

	const ok = ({ data }: { data: z.input<Success> }): Extract<Result, { kind: 'success' }> => {
		return { id, kind: 'success', data: success.parse(data) };
	};

	const failWith = ({ error, status }: { error: z.input<Failure>; status: number }) => {
		return fail(status, { id, kind: 'failure', error: failure.parse(error) } satisfies Extract<
			Result,
			{ kind: 'failure' }
		>);
	};

	return { ok, fail: failWith };
}
