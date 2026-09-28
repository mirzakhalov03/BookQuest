import { z } from 'zod';
import { ROLES } from '../constants/quest.js';
import { participantSchema } from './participant.js';

/**
 * Who the caller is, as far as the UI is concerned. `role` is here so the
 * interface can hide what it should hide — it is never what makes an admin
 * route safe. The server re-reads the role from the database on every call.
 */
export const sessionUserSchema = z.object({
  id: z.string(),
  telegramUserId: z.string().nullable(),
  phoneNumber: z.string().nullable(),
  firstName: z.string(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  role: z.enum(ROLES),
  /** Null until they register for the current quest. */
  participant: participantSchema.nullable()
});

export type SessionUser = z.infer<typeof sessionUserSchema>;
