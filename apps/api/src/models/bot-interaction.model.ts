import { Schema, model, type InferSchemaType } from 'mongoose';
import { INTERACTION_KINDS, INTERACTION_LIMITS as L, MEDIA_TYPES } from '@bookquest/shared';
import { env } from '../config/env.js';

// Sub-schemas with no default: an absent part is omitted, not stored as null — small rows, clean partial indexes.
const fromSchema = new Schema(
  { firstName: String, lastName: String, username: String, languageCode: String },
  { _id: false }
);
const contactSchema = new Schema(
  { phoneNumber: String, firstName: String, isOwn: Boolean },
  { _id: false }
);
const mediaSchema = new Schema(
  {
    type: { type: String, enum: MEDIA_TYPES },
    fileId: String,
    fileUniqueId: String,
    mimeType: String,
    fileName: String,
    durationSec: Number,
    emoji: String
  },
  { _id: false }
);
const locationSchema = new Schema({ lat: Number, lng: Number }, { _id: false });
const replySchema = new Schema(
  { messageId: Number, text: { type: String, maxlength: L.replySnippet } },
  { _id: false }
);

const botInteractionSchema = new Schema(
  {
    // Telegram's own id: a retried batch hits the unique index instead of double-inserting.
    updateId: { type: Number, required: true },
    updateType: { type: String, required: true },
    kind: { type: String, enum: INTERACTION_KINDS, required: true },
    signal: { type: Boolean, required: true },
    isEdit: { type: Boolean, default: false },

    telegramUserId: { type: String, required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    // A snapshot: names and handles change, the row should show who it was then.
    from: { type: fromSchema, required: true },
    fromAdmin: { type: Boolean, default: false },

    chatId: String,
    chatType: String,
    messageId: Number,

    text: { type: String, maxlength: L.text },
    command: { type: String, maxlength: L.command },
    commandArgs: { type: String, maxlength: L.commandArgs },
    buttonLabel: { type: String, maxlength: L.buttonLabel },
    callbackData: { type: String, maxlength: L.callbackData },
    contact: contactSchema,
    media: mediaSchema,
    location: locationSchema,
    membership: { type: String, enum: ['blocked', 'unblocked'] },
    inReplyTo: replySchema,
    broadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast', default: null },

    sentAt: { type: Date, required: true }
  },
  { timestamps: true, collection: 'bot_interactions' }
);

botInteractionSchema.index({ updateId: 1 }, { unique: true });
// Retention, and plain time order in both directions.
botInteractionSchema.index(
  { sentAt: 1 },
  { expireAfterSeconds: env.INTERACTION_RETENTION_DAYS * 24 * 60 * 60 }
);
// The default "Messages" view.
botInteractionSchema.index({ signal: 1, sentAt: -1, _id: -1 });
// One person's timeline.
botInteractionSchema.index({ telegramUserId: 1, sentAt: -1, _id: -1 });
botInteractionSchema.index({ kind: 1, sentAt: -1 });
botInteractionSchema.index(
  { command: 1, sentAt: -1 },
  { partialFilterExpression: { command: { $exists: true } } }
);
// `broadcast` defaults to null, so `$exists` would match every row; the type check matches only real links.
botInteractionSchema.index(
  { broadcast: 1, sentAt: -1 },
  { partialFilterExpression: { broadcast: { $type: 'objectId' } } }
);

export type BotInteractionAttributes = InferSchemaType<typeof botInteractionSchema>;
export const BotInteractionModel = model('BotInteraction', botInteractionSchema);
