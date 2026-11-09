import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { ROLES } from '@bookquest/shared';

/** A person. Profile fields refresh on every Telegram sign-in: names, handles and photos change. */
const userSchema = new Schema(
  {
    /* A string: ids can exceed 2^53. No `default: null` — every omitted field would
       store a shared `null` and collide on the unique index below. */
    telegramUserId: { type: String },

    // No `default: null`, same reason as telegramUserId.
    phoneNumber: { type: String, trim: true },
    // Never selected by default, so nothing has to remember not to serialise it.
    passwordHash: { type: String, select: false },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: null },
    /** The @handle. Can change; never used to identify anyone. */
    username: { type: String, default: null },
    photoUrl: { type: String, default: null },
    languageCode: { type: String, default: null },
    // An `AVATARS` id. No enum: a retired id should read as "no avatar", not fail the next save.
    avatar: { type: String, default: null },

    /* Only means "this phone account proved the shared admin password".
       Access itself is decided per request by `isAdmin` (user.services). */
    role: { type: String, enum: ROLES, default: 'participant' },

    /** Telegram answered 403 (bot blocked): later broadcasts skip the DM. Cleared on the next Telegram sign-in or /start. */
    dmBlockedAt: { type: Date, default: null },

    lastSeenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Partial, not sparse: sparse still indexes an explicit `null`, so two users without the field would collide.
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
