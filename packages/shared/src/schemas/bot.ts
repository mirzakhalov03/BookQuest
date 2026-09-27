import { z } from 'zod';

/**
 * What the bot sends when it records someone on /start. Deliberately
 * narrower than a full Telegram profile: a chat command's `ctx.from` never
 * carries a photo, so `photoUrl` is always null here — it is filled in
 * later, whenever this person actually opens the Mini App and signs in for
 * real.
 */
export const botUserUpsertSchema = z.object({
  telegramUserId: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().nullable(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  languageCode: z.string().nullable()
});

export type BotUserUpsertPayload = z.infer<typeof botUserUpsertSchema>;
