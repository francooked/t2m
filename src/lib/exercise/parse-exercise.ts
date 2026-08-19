import { exercisePayloadSchema } from './exercise-payload';

export function parseExercisePayload(row: { type: string; version: number; payload: unknown }) {
	const parsed = exercisePayloadSchema.parse(row);
	return parsed;
}

export function toPublicExercisePayload(payload: ReturnType<typeof parseExercisePayload>) {
	if (payload.type === 'full_answer') {
		if (payload.version === 1) {
			const {
				type,
				version,
				payload: { front, extra }
			} = payload;
			return { type, version, payload: { front, extra } };
		}
	}

	throw new Error('Undefined exercise type or version');
}
