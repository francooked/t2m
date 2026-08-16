import * as z from 'zod';

export function defineSuccess<T extends z.ZodType>(schema: T): T {
	return schema;
}

export function defineFailure<T extends z.ZodType<{ code: string }>>(schema: T): T {
	return schema;
}

export type FormResult<Id extends string, Data, Error extends { code: string }> =
	{ id: Id; kind: 'success'; data: Data } | { id: Id; kind: 'failure'; error: Error };

export type InferFormResult<
	Id extends string,
	Success extends z.ZodType,
	Failure extends z.ZodType<{ code: string }>
> = FormResult<Id, z.output<Success>, z.output<Failure>>;

export function buildContract<
	Id extends string,
	Success extends z.ZodType,
	Failure extends z.ZodType<{ code: string }>
>({ id, success, failure }: { id: Id; success: Success; failure: Failure }) {
	return z.union([
		z.object({ id: z.literal(id), kind: z.literal('success'), data: success }),
		z.object({ id: z.literal(id), kind: z.literal('failure'), error: failure })
	]);
}
