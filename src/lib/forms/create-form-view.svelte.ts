import * as z from 'zod';
import type { SubmitFunction } from '@sveltejs/kit';
import { buildContract, type InferFormResult } from './contract';

export function createFormView<
	Id extends string,
	Success extends z.ZodType,
	Failure extends z.ZodType<{ code: string }>
>({ id, success, failure }: { id: Id; success: Success; failure: Failure }) {
	const schema = buildContract({ id, success, failure });

	let view = $state<
		| { status: 'idle'; id: Id }
		| { status: 'pending'; id: Id }
		| { status: 'success'; id: Id; data: z.output<Success> }
		| { status: 'failure'; id: Id; error: z.output<Failure> | { code: 'unexpected' } }
	>({ id, status: 'idle' });

	const parseResult = (raw: unknown) => {
		const parsed = schema.safeParse(raw);

		if (!parsed.success) {
			throw new Error('Form result did not satisfy the contract');
		}

		return parsed.data as unknown as InferFormResult<Id, Success, Failure>;
	};

	const enhance: SubmitFunction = () => {
		view = { id, status: 'pending' };

		return async ({ result, update }) => {
			if (result.type === 'error') {
				view = { id, status: 'failure', error: { code: 'unexpected' } };
				return;
			}

			if (result.type === 'redirect') {
				view = { id, status: 'idle' };
				await update();
				return;
			}

			const payload = parseResult(result.data);

			if (payload.kind === 'success') {
				view = { status: 'success', id, data: payload.data };
			} else {
				view = { status: 'failure', id, error: payload.error };
			}

			await update({ reset: result.type === 'success' });
		};
	};

	const sync = (getForm: () => unknown) => {
		if (view.status === 'pending') return;

		const form = getForm();
		if (form === null) return;

		if (typeof form !== 'object' || !('id' in form) || form.id !== id) {
			if (view.status !== 'idle') view = { id, status: 'idle' };
			return;
		}

		const payload = parseResult(form);

		if (payload.kind === 'success') {
			view = { status: 'success', id, data: payload.data };
		} else {
			view = { status: 'failure', id, error: payload.error };
		}
	};

	return {
		enhance,
		sync,
		get view() {
			return view;
		}
	};
}
