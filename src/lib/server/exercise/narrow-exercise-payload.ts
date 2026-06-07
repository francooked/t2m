import * as schema from '$lib/server/db/schema';
import {
	fullAnswerPayloadV1Schema,
	type FullAnswerPayloadV1
} from '../../exercise/exercise-payload';

export type SelectFnMap = {
	full_answer: {
		1: (payload: FullAnswerPayloadV1) => unknown;
	};
};

export function narrowExercisePayload<S extends SelectFnMap>(
	row: Pick<typeof schema.exercise.$inferSelect, 'id' | 'type' | 'version' | 'payload'>,
	selectFn: S
) {
	if (row.type === 'full_answer' && row.version === 1) {
		const payload = fullAnswerPayloadV1Schema.parse(row.payload);
		return {
			id: row.id,
			type: 'full_answer' as const,
			version: 1 as const,
			payload: selectFn.full_answer[1](payload) as ReturnType<S['full_answer'][1]>
		};
	}
	throw new Error(`Unsupported exercise ${row.type} v${row.version}`);
}
