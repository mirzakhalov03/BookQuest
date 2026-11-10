import { z } from 'zod';
import type { CursorPage } from '../api.js';

export const INTERACTION_KINDS = [
  'text',
  'command',
  'button',
  'contact',
  'media',
  'location',
  'web_app_data',
  'membership',
  'other'
] as const;
export type InteractionKind = (typeof INTERACTION_KINDS)[number];

export const MEDIA_TYPES = [
  'photo',
  'voice',
  'video',
  'video_note',
  'audio',
  'document',
  'sticker',
  'animation'
] as const;
export type MediaType = (typeof MEDIA_TYPES)[number];

/** One set of caps: the bot truncates to them, the API rejects past them. */
export const INTERACTION_LIMITS = {
  text: 4096,
  command: 64,
  commandArgs: 256,
  buttonLabel: 128,
  callbackData: 64,
  replySnippet: 280,
  batch: 100
} as const;

const L = INTERACTION_LIMITS;
const str = (max: number) => z.string().max(max);
const telegramId = z.string().regex(/^-?\d{1,20}$/);

/** What apps/bot sends per update. Strict: an unknown key means the two sides drifted. */
export const interactionInputSchema = z.strictObject({
  updateId: z.number().int().nonnegative(),
  updateType: str(32).min(1),
  kind: z.enum(INTERACTION_KINDS),
  isEdit: z.boolean().optional(),

  telegramUserId: telegramId,
  from: z.strictObject({
    firstName: str(128),
    lastName: str(128).optional(),
    username: str(64).optional(),
    languageCode: str(16).optional()
  }),

  chatId: telegramId.optional(),
  chatType: str(32).optional(),
  messageId: z.number().int().optional(),

  text: str(L.text).optional(),
  command: str(L.command).optional(),
  commandArgs: str(L.commandArgs).optional(),
  buttonLabel: str(L.buttonLabel).optional(),
  callbackData: str(L.callbackData).optional(),
  contact: z
    .strictObject({ phoneNumber: str(32), firstName: str(128).optional(), isOwn: z.boolean() })
    .optional(),
  media: z
    .strictObject({
      type: z.enum(MEDIA_TYPES),
      fileId: str(256),
      fileUniqueId: str(128),
      mimeType: str(128).optional(),
      fileName: str(256).optional(),
      durationSec: z.number().int().nonnegative().optional(),
      emoji: str(16).optional()
    })
    .optional(),
  location: z
    .strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
    .optional(),
  membership: z.enum(['blocked', 'unblocked']).optional(),
  inReplyTo: z
    .strictObject({ messageId: z.number().int(), text: str(L.replySnippet).optional() })
    .optional(),

  sentAt: z.iso.datetime()
});
export type InteractionInput = z.infer<typeof interactionInputSchema>;

export const botInteractionsBatchSchema = z.strictObject({
  items: z.array(interactionInputSchema).min(1).max(L.batch)
});
export type BotInteractionsBatch = z.infer<typeof botInteractionsBatchSchema>;

/** One row on the admin Messages page. Absent parts are `null`, never missing. */
export interface Interaction {
  id: string;
  kind: InteractionKind;
  signal: boolean;
  isEdit: boolean;
  telegramUserId: string;
  userId: string | null;
  from: { firstName: string; lastName: string | null; username: string | null };
  fromAdmin: boolean;
  text: string | null;
  command: string | null;
  commandArgs: string | null;
  buttonLabel: string | null;
  callbackData: string | null;
  contact: { phoneNumber: string; firstName: string | null; isOwn: boolean } | null;
  media: {
    type: MediaType;
    mimeType: string | null;
    fileName: string | null;
    durationSec: number | null;
    emoji: string | null;
  } | null;
  location: { lat: number; lng: number } | null;
  membership: 'blocked' | 'unblocked' | null;
  inReplyTo: { messageId: number; text: string | null } | null;
  /** The broadcast this most likely answers, with the opening of its message. */
  broadcast: { id: string; snippet: string } | null;
  sentAt: string;
}

/** Everything the person sheet needs, in the same response as their timeline. */
export interface PersonSummary {
  telegramUserId: string;
  userId: string | null;
  firstName: string;
  lastName: string | null;
  username: string | null;
  /** From their account, else the newest contact they shared of themselves. */
  phoneNumber: string | null;
  firstSeenAt: string | null;
  lastSeenAt: string | null;
  total: number;
  blocked: boolean;
}

export interface InteractionList extends CursorPage<Interaction> {
  /** Cursor of the first row — what the "N new" poll passes as `since`. */
  headCursor: string | null;
  person?: PersonSummary;
}

export interface InteractionFacets {
  kinds: Record<InteractionKind, number>;
  commands: { command: string; count: number }[];
}
