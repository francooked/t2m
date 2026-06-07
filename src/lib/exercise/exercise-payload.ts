import z from 'zod';

export const fullAnswerPayloadV1Schema = z.object({
	front: z.string().min(1),
	back: z.string().min(1),
	extra: z.string().min(1)
});

export type FullAnswerPayloadV1 = z.infer<typeof fullAnswerPayloadV1Schema>;
export type ExercisePayload = FullAnswerPayloadV1;
