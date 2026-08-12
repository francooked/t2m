export type FormResultContract = { id: string } & (
	{ kind: 'success'; data?: unknown } | { kind: 'failure'; code: string }
);
