import bcrypt from 'bcrypt';
import { adminTelegramIds } from '../config/env.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { TelegramProfile } from '../utils/telegram.js';
import { ApiError } from '../utils/api-error.js';

const BCRYPT_COST = 12;

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

/** POST /auth/register. Throws 409 if the email is already in use. */
export async function createUserWithEmail(
  email: string,
  password: string,
  firstName: string
): Promise<UserDocument> {
  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw ApiError.conflict('That email is already in use.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  return UserModel.create({
    email,
    passwordHash,
    firstName,
    role: 'participant'
  });
}

/**
 * For login. Explicit `+passwordHash` — the schema excludes it by default
 * (see the User model), so a normal query would return `undefined` and
 * every `bcrypt.compare` would fail even with the right password.
 */
export function findUserByEmail(email: string): Promise<UserDocument | null> {
  return UserModel.findOne({ email }).select('+passwordHash');
}

/**
 * Attaches a Telegram identity to an already-authenticated user. Throws 409
 * if that Telegram id is already claimed by a *different* account — this is
 * an attach, never a merge.
 */
export async function linkTelegramToUser(
  user: UserDocument,
  profile: TelegramProfile
): Promise<UserDocument> {
  const claimedBy = await UserModel.findOne({ telegramUserId: profile.telegramUserId });
  if (claimedBy && claimedBy.id !== user.id) {
    throw ApiError.conflict('That Telegram account is already connected to a different user.');
  }

  user.telegramUserId = profile.telegramUserId;
  user.username = profile.username;
  user.photoUrl = profile.photoUrl;
  user.languageCode = profile.languageCode;
  await user.save();
  return user;
}
