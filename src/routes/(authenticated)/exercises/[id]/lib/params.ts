import z from 'zod';

/** Params for `/exercises/[id]`. Child routes import this and `.extend()` if they add params. */
export const paramsSchema = z.object({
	id: z.coerce.number().int().positive()
});
