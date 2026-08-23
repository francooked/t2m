import { exercisePayloadSchema } from './exercise-payload';

/** Validates the exercise jsonb envelope `{ type, version, payload }`. */
export function parseExercisePayload(payload: unknown) {
	return exercisePayloadSchema.parse(payload);
}

/** Strips `back` so the client never sees the expected answer. */
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
