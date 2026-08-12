import type { SubmitFunction } from '@sveltejs/kit';
import type { FormResultContract } from './contract';

export type ViewState<R extends FormResultContract> =
	| { status: 'idle'; id: R['id'] }
	| { status: 'pending'; id: R['id'] }
	| ({ status: 'success' } & Omit<Extract<R, { kind: 'success' }>, 'kind'>)
	| ({ status: 'failure' } & Omit<Extract<R, { kind: 'failure' }>, 'kind'>);

export function isContractSatisfied(
	data: Record<string, unknown> | undefined
): data is FormResultContract {
	if (typeof data !== 'object') return false;

	const id = data.id;
	const kind = data.kind;

	if (
		typeof id !== 'string' ||
		typeof kind !== 'string' ||
		(kind !== 'success' && kind !== 'failure')
	)
		return false;

	if (kind === 'success' && data.data !== undefined && typeof data.data !== 'object') return false;

	if (kind === 'failure' && typeof data.code !== 'string') return false;

	return true;
}

function formToView<R extends FormResultContract>(form: R): ViewState<R> {
	if (form.kind === 'success') {
		return { status: form.kind, id: form.id, data: form.data };
	}
	return { status: form.kind, id: form.id, code: form.code };
}

export function createFormView<R extends FormResultContract>({ id }: { id: R['id'] }) {
	let view = $state<ViewState<R>>({ id, status: 'idle' });

	const enhance: SubmitFunction = () => {
		view = { id, status: 'pending' };

		return async ({ result, update }) => {
			if (result.type === 'error') {
				// TODO: Log to Sentry.
				view = { id, status: 'failure', code: 'unexpected' };
				return;
			}

			if (result.type === 'redirect') {
				view = { id, status: 'idle' };
				await update();
				return;
			}

			if (
				!isContractSatisfied(result.data) ||
				result.type !== result.data.kind ||
				result.data.id !== id
			) {
				// TODO: Log to Sentry.
				view = { id, status: 'idle' };
				throw new Error(`[createFormView] Form result did not satisfy the contract`);
			}

			await update({ reset: false });
		};
	};

	const sync = (getForm: () => R | null) => {
		const form = getForm();

		if (!form || form.id !== id) {
			if (view.status !== 'idle' && view.status !== 'pending') {
				view = { id, status: 'idle' };
			}
			return;
		}

		view = formToView(form);
	};

	return {
		enhance,
		sync,
		get view() {
			return view;
		}
	};
}
