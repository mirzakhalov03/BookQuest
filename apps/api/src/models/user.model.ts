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
       a phone/password account has no Telegram id until it's linked. No
       `default: null` — a partial unique index (below) only excludes a
       document where the field is genuinely absent, and Mongoose would
       otherwise write an explicit `null` into every document that omits it,
       colliding on that one shared `null` past the first such document. */
    telegramUserId: { type: String },

    /* Optional: a Telegram-only account never sets this. Trimmed on write.
       No `default: null` — see telegramUserId above. */
    phoneNumber: { type: String, trim: true },
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
    /* An id from the shared `AVATARS` list. No enum here: the set will be
       swapped, and a retired id should read back as "no avatar", not fail
       validation on the user's next save. */
    avatar: { type: String, default: null },

    /* Resolved from ADMIN_TELEGRAM_IDS at login and re-read from here on every
       admin request. There is no endpoint that writes it. */
    role: { type: String, enum: ROLES, default: 'participant' },

    lastSeenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Partial, not sparse: a sparse index only excludes a document where the
// field is *missing* — it still indexes an explicit `null`, so two users
// with no Telegram id (or no phone number) would collide on that shared
// `null`. A partial filter excludes anything that isn't actually a string,
// `null` included, so any number of users can have neither.
userSchema.index(
  { telegramUserId: 1 },
  {
    unique: true,
    partialFilterExpression: { telegramUserId: { $type: 'string' } },
    name: 'telegramUserId_unique_partial'
  }
);
userSchema.index(
  { phoneNumber: 1 },
  {
    unique: true,
    partialFilterExpression: { phoneNumber: { $type: 'string' } },
    name: 'phoneNumber_unique_partial'
  }
);

export type UserAttributes = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserAttributes>;

export const UserModel = model('User', userSchema);
