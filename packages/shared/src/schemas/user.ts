import { z } from 'zod';
import { AVATARS } from '../constants/avatar.js';
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
  /** Null means no pick yet — the UI falls back to initials. */
  avatar: z.enum(AVATARS).nullable(),
  role: z.enum(ROLES),
  /** Null until they register for the current quest. */
  participant: participantSchema.nullable()
});

export type SessionUser = z.infer<typeof sessionUserSchema>;

/** PATCH /auth/me. `avatar: null` goes back to initials. */
export const updateProfileSchema = z.object({
  avatar: z.enum(AVATARS, { message: 'Pick one of the avatars on offer.' }).nullable()
});

export type UpdateProfilePayload = z.infer<typeof updateProfileSchema>;
