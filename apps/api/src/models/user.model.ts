import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from '@bookquest/shared';

/**
 * A person, as Telegram knows them. Created on first successful sign-in; the
 * profile fields are refreshed on every login because a Telegram name, handle
 * or photo can change at any time and nothing here is a key.
 */
const userSchema = new Schema(
  {
    /* Stored as a string. Telegram ids can exceed 2^53, and a number that
       silently loses its last digit would match the wrong account. Optional:
       an email/password account has no Telegram id until it's linked. */
    telegramUserId: { type: String, default: null },

    /* Optional: a Telegram-only account never sets these. Lowercased and
       trimmed on write so "Jane@X.com" and "jane@x.com" are one account. */
    email: { type: String, default: null, lowercase: true, trim: true },
    /* Excluded from default query results — nothing should ever have to
       remember not to serialize this. */
    passwordHash: { type: String, default: null, select: false },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: null },
    /** The @handle. Can change; never used to identify anyone. */
    username: { type: String, default: null },
    photoUrl: { type: String, default: null },
    languageCode: { type: String, default: null },

    /* Resolved from ADMIN_TELEGRAM_IDS at login and re-read from here on every
       admin request. There is no endpoint that writes it. */
    role: { type: String, enum: ROLES, default: 'participant' },

    lastSeenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Sparse: many users have no telegramUserId or no email, and sparse indexes
// skip documents where the field is null instead of colliding on it.
userSchema.index({ telegramUserId: 1 }, { unique: true, sparse: true });
userSchema.index({ email: 1 }, { unique: true, sparse: true });

export type UserAttributes = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttributes>;

export const UserModel = model('User', userSchema);
