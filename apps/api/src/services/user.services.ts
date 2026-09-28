import bcrypt from 'bcrypt';
import { adminPhoneNumbers, adminTelegramIds } from '../config/env.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { TelegramProfile } from '../utils/telegram.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';

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

/** POST /auth/register. Throws 409 if the phone number is already in use. */
export async function createUserWithPhone(
  phoneNumber: string,
  password: string,
  firstName: string
): Promise<UserDocument> {
  const existing = await UserModel.findOne({ phoneNumber });
  if (existing) {
    throw ApiError.conflict('That phone number is already in use.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const role = adminPhoneNumbers.has(phoneNumber) ? 'admin' : 'participant';

  try {
    return await UserModel.create({
      phoneNumber,
      passwordHash,
      firstName,
      role
    });
  } catch (error) {
    /* The findOne above is a courtesy; this is the guarantee. Two requests
       can both pass the check, and only the unique index decides which one
       wins — the loser gets the same message the check above would have
       given, not a raw driver error. */
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict('That phone number is already in use.');
    }
    throw error;
  }
}

/**
 * For login. Explicit `+passwordHash` — the schema excludes it by default
 * (see the User model), so a normal query would return `undefined` and
 * every `bcrypt.compare` would fail even with the right password.
 */
export function findUserByPhone(phoneNumber: string): Promise<UserDocument | null> {
  return UserModel.findOne({ phoneNumber }).select('+passwordHash');
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

  try {
    await user.save();
  } catch (error) {
    // Same race as createUserWithPhone: the findOne above is a courtesy,
    // the unique index is the guarantee.
    if (isDuplicateKeyError(error)) {
      throw ApiError.conflict('That Telegram account is already connected to a different user.');
    }
    throw error;
  }

  return user;
}
