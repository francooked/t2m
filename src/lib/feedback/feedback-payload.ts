import * as z from 'zod';

export const feedbackExampleSchema = z.object({
	wrote: z.string().min(1),
	instead: z.string().min(1)
});

export const feedbackPatternSchema = z.object({
	what: z.string().min(1),
	why: z.string().min(1),
	how: z.string().min(1),
	soundsLike: z.string().min(1),
	examples: z.array(feedbackExampleSchema).min(1).max(2)
});

export const feedbackPayloadSchema = z.discriminatedUnion('version', [
	z.object({
		version: z.literal(1),
		payload: z.object({ patterns: z.array(feedbackPatternSchema).min(1).max(3) })
	})
]);

export type FeedbackPayloadSchema = z.infer<typeof feedbackPayloadSchema>;
