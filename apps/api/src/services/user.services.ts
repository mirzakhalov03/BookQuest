import { adminTelegramIds } from '../config/env.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { TelegramProfile } from '../utils/telegram.js';

/**
 * The one place a Telegram profile becomes a `User` row. Both a real sign-in
 * (`auth.services.ts`, verified `initData`) and the bot's `/start` (verified
 * only by the service token — see `bot-service.middleware.ts`) call this, so
 * there is exactly one answer to "what does upserting a user mean" no matter
 * which side triggered it.
 */
export async function upsertUserFromTelegramProfile(
  profile: TelegramProfile
): Promise<UserDocument> {
  const role = adminTelegramIds.has(profile.telegramUserId) ? 'admin' : 'participant';

  return UserModel.findOneAndUpdate(
    { telegramUserId: profile.telegramUserId },
    {
      $set: {
        firstName: profile.firstName,
        lastName: profile.lastName,
        username: profile.username,
        photoUrl: profile.photoUrl,
        languageCode: profile.languageCode,
        role,
        lastSeenAt: new Date()
      }
    },
    { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true }
  );
}
