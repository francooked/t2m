import * as z from 'zod';
import type { SubmitFunction } from '@sveltejs/kit';
import { buildContract, type InferFormResult } from './contract';

export function createFormView<
	Id extends string,
	Success extends z.ZodType,
	Failure extends z.ZodType<{ code: string }>
>({
	id,
	success,
	failure,
	getForm
}: {
	id: Id;
	success: Success;
	failure: Failure;
	getForm: () => unknown;
}) {
	const schema = buildContract({ id, success, failure });

	let pending = $state<boolean>(false);
	let unexpected = $state<boolean>(false);

	const parsed = $derived.by(() => {
		const form = getForm();

		if (form === null || typeof form !== 'object' || !('id' in form) || form.id !== id) {
			return null;
		}

		const result = schema.safeParse(form);

		if (!result.success) {
			throw new Error('Form result does not satisfy the contract');
		}

		return result.data as InferFormResult<Id, Success, Failure>;
	});

	const view = $derived.by<
		| { status: 'idle'; id: Id }
		| { status: 'pending'; id: Id }
		| { status: 'success'; id: Id; data: z.output<Success> }
		| { status: 'failure'; id: Id; error: z.output<Failure> | { code: 'unexpected' } }
	>(() => {
		if (pending) return { status: 'pending' as const, id };

		if (parsed?.kind === 'success') {
			return { status: 'success' as const, id, data: parsed.data };
		}

		if (parsed?.kind === 'failure') {
			return { status: 'failure' as const, id, error: parsed.error };
		}

		if (unexpected) {
			return { status: 'failure' as const, id, error: { code: 'unexpected' as const } };
		}

		return { status: 'idle' as const, id };
	});

	const enhance: SubmitFunction = () => {
		pending = true;
		unexpected = false;

		return async ({ result, update }) => {
			pending = false;

			if (result.type === 'error') {
				unexpected = true;
				return;
			}

			if (result.type === 'redirect') {
				await update();
				return;
			}

			await update({ reset: result.type === 'success' });
		};
	};

	return {
		enhance,
		get view() {
			return view;
		}
	};
}
