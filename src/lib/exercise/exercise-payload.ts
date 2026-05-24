import z from 'zod';

export const fullAnswerPayloadV1Schema = z.object({
	front: z.string().min(1),
	back: z.string().min(1)
});

export const fullAnswerPayloadV2Schema = z.object({
	front: z.string().min(1),
	back: z.string().min(1),
	extra: z.string().min(1)
});

export type FullAnswerPayloadV1 = z.infer<typeof fullAnswerPayloadV1Schema>;
export type FullAnswerPayloadV2 = z.infer<typeof fullAnswerPayloadV2Schema>;
export type ExercisePayload = FullAnswerPayloadV1 | FullAnswerPayloadV2;
