import z from 'zod';

export const exercisePayloadSchema = z.discriminatedUnion('type', [
	z.discriminatedUnion('version', [
		z.object({
			type: z.literal('full_answer'),
			version: z.literal(1),
			payload: z.object({
				front: z.string().min(1),
				back: z.string().min(1),
				extra: z.string().min(1)
			})
		})
	])
]);

export type ExercisePayload = z.infer<typeof exercisePayloadSchema>;
