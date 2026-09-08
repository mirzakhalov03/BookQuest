import { z } from 'zod';

/** `:edition` is the number people say out loud, not a database id. */
export const questEditionParams = z.object({
  edition: z.coerce.number().int().positive()
});

export const questArchiveQuery = z.object({
  limit: z.coerce.number().int().positive().max(50).default(20),
  cursor: z.string().max(64).optional()
});
