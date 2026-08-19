import * as z from 'zod';

export const exerciseCheckPayloadSchema = z.discriminatedUnion('type', [
	z.discriminatedUnion('version', [
		z.object({
			type: z.literal('full_answer'),
			version: z.literal(1),
			payload: z.object({
				answer: z.string().min(1),
				tips: z.array(z.string())
			})
		})
	])
]);

export type ExerciseCheckPayload = z.infer<typeof exerciseCheckPayloadSchema>['payload'];
