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
       an email/password account has no Telegram id until it's linked. No
       `default: null` — a partial unique index (below) only excludes a
       document where the field is genuinely absent, and Mongoose would
       otherwise write an explicit `null` into every document that omits it,
       colliding on that one shared `null` past the first such document. */
    telegramUserId: { type: String },

    /* Optional: a Telegram-only account never sets these. Lowercased and
       trimmed on write so "Jane@X.com" and "jane@x.com" are one account.
       No `default: null` — see telegramUserId above. */
    email: { type: String, lowercase: true, trim: true },
    /* Excluded from default query results — nothing should ever have to
       remember not to serialize this. No `default: null` for the same
       reason, though this field isn't indexed. */
    passwordHash: { type: String, select: false },

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

// Partial, not sparse: a sparse index only excludes a document where the
// field is *missing* — it still indexes an explicit `null`, so two users
// with no Telegram id (or no email) would collide on that shared `null`.
// A partial filter excludes anything that isn't actually a string, `null`
// included, so any number of users can have neither.
userSchema.index(
  { telegramUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { telegramUserId: { $type: 'string' } },
    name: 'telegramUserId_unique_partial'
  }
);
userSchema.index(
  { email: 1 },
  {
    unique: true,
    partialFilterExpression: { email: { $type: 'string' } },
    name: 'email_unique_partial'
  }
);

export type UserAttributes = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttributes>;

export const UserModel = model('User', userSchema);
