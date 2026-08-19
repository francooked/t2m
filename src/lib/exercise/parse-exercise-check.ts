import { exerciseCheckPayloadSchema } from './exercise-check-payload';

export function parseExerciseCheckPayload(row: {
	type: string;
	version: number;
	payload: unknown;
}) {
	const parsed = exerciseCheckPayloadSchema.parse(row);
	return parsed;
}
