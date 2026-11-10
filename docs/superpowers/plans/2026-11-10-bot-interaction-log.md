# Bot Interaction Log Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record everything users send to the bot (text, commands, button taps, contacts, media, location, block/unblock) and show it to organisers on one filterable admin page, `/admin/messages`.

**Architecture:** A first-position Telegraf middleware turns each update into an `InteractionInput` (pure `toInteraction`). It buffers the item in memory and calls `next()`. The buffer flushes over HTTP every 2 s or 50 items to `POST /api/v1/bot/interactions` (bot-service token). The API validates, stamps each row `signal` (worth reading) or not, links it to the `User` and to the broadcast it most likely answers, applies block/unblock to `User.dmBlockedAt`, and `insertMany`s into `bot_interactions` (unique `updateId`, TTL on `sentAt`). Admins read it through `GET /api/v1/admin/interactions` (cursor pages) and `/facets`. The web page keeps its filters in the URL and loads pages as the reader scrolls. When newer rows arrive it shows a "● N new" pill instead of moving the list.

**Tech Stack:** Telegraf 4 (`telegraf/types`), Express 5 + TypeScript, Mongoose 9, Zod 4; React + Vite + Tailwind, React Query (`useInfiniteQuery`), React Router, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-09-bot-interaction-log-design.md`

## Global Constraints

- **Recording never blocks or breaks a reply.** The middleware does no I/O and never throws. Flushes are fire-and-forget. A failed batch is retried once after 2 s and then dropped.
- **No message content in any log**, in the bot or the API. That means no `text`, `contact`, captions, `callbackData`, `commandArgs`, `inReplyTo.text` or `web_app_data`. Logs carry ids, counts and statuses only.
- Telegram ids are **strings** everywhere (ids can pass 2^53).
- Field caps, applied once in `@bookquest/shared` and enforced by the API: `text` 4096, `command` 64, `commandArgs` 256, `buttonLabel` 128, `callbackData` 64, `inReplyTo.text` 280, batch 1–100 items, body ≤ 256 kb. The bot truncates to these caps before sending, so a long caption is shortened, not rejected.
- Content is rendered as **plain text** on the web. No `dangerouslySetInnerHTML`, no auto-linking.
- Admin auth comes from the `/admin` mount (`requireUser, requireAdmin`). Nothing is added per route.
- Decisions taken (owner, 10 Nov): **keep** the `blocked`/`unblocked` → `User.dmBlockedAt` side effect. **No** "your messages are stored" notice anywhere.
- Per the user's CLAUDE.md, **no automated tests**. Each task is verified with `pnpm typecheck` plus the manual and `curl` checks it lists.
- Backend naming: `*.routes.ts`, `*.controllers.ts`, `*.services.ts`, `*.middleware.ts`, `*.model.ts`. Comments are one-liners explaining *why*.
- Commits end with the `Co-Authored-By` / `Claude-Session` trailers from the session. Stage only the files each task names.

## Review Focus

1. **The global JSON parser runs first.** `app.ts` mounts `express.json({ limit: '100kb' })` for everything, so a route-level 256 kb parser inside `bot.routes.ts` would never run. A burst batch would get 413 from the global parser. Task 3 mounts the larger parser in `app.ts` **ahead of** the global one, scoped to `/api/v1/bot/interactions` (body-parser skips a body that is already parsed). Task 3 Step 9 posts a ~150 kb batch to prove it.
2. **`allowedUpdates` persists on Telegram's side.** `getUpdates` without `allowed_updates` reuses whatever the last caller set, so `my_chat_member` might never arrive. Task 4 passes the list explicitly to `bot.launch`. Task 4 Step 9 blocks and unblocks the bot to check.
3. **An animation message also carries `document`.** `mediaOf` must test `animation` before `document`, or GIFs are logged as documents. Task 4 Step 9 sends a GIF.
4. **Duplicate retries.** `insertMany(..., { ordered: false })` throws a bulk error even when every failure is a duplicate `updateId`. `isOnlyDuplicateKeyErrors` must treat that case as success (202), not a 500. Task 3 Step 9 posts the same batch twice.
5. **Cursor refetch duplicates.** Refetching an infinite query re-runs pages 2..n with their *old* cursors, after page 1 has gained rows, which duplicates rows at the page seams. The "N new" pill therefore **resets** the query (first page only) instead of refetching. Task 7 Step 8 checks for duplicate keys in the console.
6. **Six tabs at phone width.** The admin tab bar goes from 5 to 6 destinations. `.tabbar` changes from `repeat(5, 1fr)` to auto columns, so the participant bar (5) is unchanged. Task 7 Step 8 checks a 360 px viewport.
7. **TTL index changes.** Changing `INTERACTION_RETENTION_DAYS` changes the TTL option. Task 3 calls `BotInteractionModel.syncIndexes()` at boot, as already done for `User`, so the index is rebuilt instead of an index-build error firing silently.

---

## File Structure

```
packages/shared/src/schemas/interaction.ts            new   — kinds, caps, interactionInput (bot→API), DTOs
packages/shared/src/schemas/index.ts                  mod   — re-export interaction

apps/api/src/utils/crypto.ts                          new   — sha256 + safeEqual (moved out of auth.services)
apps/api/src/utils/regex.ts                           new   — escapeRegex (moved out of admin.services)
apps/api/src/utils/mongo.ts                           mod   — isOnlyDuplicateKeyErrors
apps/api/src/utils/time-zone.ts                       mod   — dayStartIn / dayEndIn
apps/api/src/utils/cursor.ts                          new   — opaque { sentAt, _id } cursor
apps/api/src/services/auth.services.ts                mod   — use utils/crypto
apps/api/src/services/admin.services.ts               mod   — use utils/regex
apps/api/src/services/user.services.ts                mod   — isAdmin accepts a lean user
apps/api/src/middlewares/bot-service.middleware.ts    mod   — constant-time token compare
apps/api/src/config/env.ts                            mod   — INTERACTION_RETENTION_DAYS
apps/api/src/models/bot-interaction.model.ts          new   — bot_interactions
apps/api/src/db/connect.ts                            mod   — syncIndexes for the new model
apps/api/src/services/interaction-classify.services.ts new  — isSignal
apps/api/src/services/interaction.services.ts         new   — recordInteractions, listInteractions, getFacets
apps/api/src/validators/bot.validators.ts             mod   — botInteractionsBody
apps/api/src/validators/admin.validators.ts           mod   — adminInteractionQuery, adminInteractionFacetsQuery
apps/api/src/controllers/bot.controllers.ts           mod   — recordInteractions
apps/api/src/controllers/admin/interaction.controllers.ts new — listInteractions, getFacets
apps/api/src/routes/bot.routes.ts                     mod   — POST /interactions
apps/api/src/routes/admin/interaction.routes.ts       new   — GET /, GET /facets
apps/api/src/routes/admin/index.ts                    mod   — mount /interactions
apps/api/src/app.ts                                   mod   — 256 kb parser for the ingest route
apps/api/src/scripts/reclassify-interactions.ts       new   — recompute `signal`
apps/api/package.json                                 mod   — reclassify:interactions script

apps/bot/src/keyboards.ts                             new   — reply-keyboard label registry (empty today)
apps/bot/src/lib/interactions.ts                      new   — toInteraction(update, botId)
apps/bot/src/lib/interaction-recorder.ts              new   — buffer + flush
apps/bot/src/lib/api-client.ts                        mod   — postInteractions
apps/bot/src/middlewares/record-interaction.ts        new   — Telegraf middleware
apps/bot/src/bot.ts                                   mod   — register first, allowedUpdates, flush on shutdown

apps/web/src/lib/format.ts                            mod   — formatTimeAgo
apps/web/src/features/admin/api/adminKeys.ts          mod   — interactions keys
apps/web/src/features/admin/api/useAdminInteractions.ts new — list (infinite), new-count, facets
apps/web/src/features/admin/interactions/filters.ts   new   — URL ⇄ filters, range presets, query params
apps/web/src/features/admin/interactions/MessagesPage.tsx       new
apps/web/src/features/admin/interactions/InteractionFilters.tsx new
apps/web/src/features/admin/interactions/InteractionsTable.tsx  new
apps/web/src/features/admin/interactions/InteractionContent.tsx new
apps/web/src/features/admin/interactions/KindChip.tsx           new
apps/web/src/features/admin/interactions/PersonSheet.tsx        new
apps/web/src/features/admin/components/CopyButton.tsx           new   — extracted from ContactLink
apps/web/src/features/admin/components/ContactLink.tsx          mod   — use CopyButton
apps/web/src/features/admin/screens.ts                mod   — export MessagesPage
apps/web/src/app/router.tsx                           mod   — /admin/messages + /all-usermessages redirect
apps/web/src/layouts/AdminLayout.tsx                  mod   — Messages tab
apps/web/src/styles/shell.css                         mod   — tab bar takes any number of tabs
apps/web/src/lib/api/mock/interactions.ts             new   — fixtures + handlers
apps/web/src/lib/api/mock/routes.ts                   mod   — register the two GETs

.env.example                                          mod   — INTERACTION_RETENTION_DAYS
```

Small refinements over the spec, same behaviour:
- `toInteraction(update, botId)` takes the bot's id, so `inReplyTo` is filled only for replies to *the bot's* messages (`reply_to_message.from.id === botId`), not for replies to forwarded messages.
- A `callback_query` has no `date`, so its `sentAt` is the time the bot received it.
- `my_chat_member` is recorded only for private chats, and `unblocked` only when the old status was `kicked`. Joining a group is not a user unblocking the bot.
- The block/unblock side effect is time-guarded: `blocked` sets `dmBlockedAt = sentAt` only if that is newer, and `unblocked` clears it only if `dmBlockedAt ≤ sentAt`. A late retried batch can't undo a newer state.
- The broadcast link is one `Notification.find` per batch, matched in memory, rather than an aggregation pipeline. It is the same single round trip and easier to read.
- The list response also carries `headCursor` (the cursor of its first row), and the list accepts `since=<cursor>`. That is how the "N new" poll asks for rows newer than the top one without decoding an opaque cursor in the browser.
- `auditAdmin` runs on the **first page only**. Load-more and the 30 s new-rows poll would otherwise write an audit line every 30 s per open tab.
- The bot's `shutdown` calls `bot.stop()` **first** and then flushes (bounded at 3 s). Stopping polling first means no update can be recorded after the last flush.
- `sha256`/`safeEqual` move to `utils/crypto.ts`, so the admin password check and the bot-token check share one constant-time compare.
- `ContactLink`'s copy button is extracted to `CopyButton`, so the person cell's "copy id" doesn't duplicate it.
- The web computes range presets ("Last 7 days") as `YYYY-MM-DD` in `Asia/Tashkent` (`ORGANISER_TIME_ZONE` in `filters.ts`, mirroring the API default). The API reads them as whole days in its own `ORGANISER_TIME_ZONE`.

---

### Task 1: Shared interaction schemas

**Files:**
- Create: `packages/shared/src/schemas/interaction.ts`
- Modify: `packages/shared/src/schemas/index.ts`

**Interfaces:**
- Produces: `INTERACTION_KINDS`, `InteractionKind`, `MEDIA_TYPES`, `MediaType`, `INTERACTION_LIMITS`, `interactionInputSchema`, `InteractionInput`, `botInteractionsBatchSchema`, `BotInteractionsBatch`, `Interaction`, `InteractionList`, `InteractionFacets`, `PersonSummary`, all exported from `@bookquest/shared`.

- [ ] **Step 1: Create `packages/shared/src/schemas/interaction.ts`**

```ts
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

export const MEDIA_TYPES = ['photo', 'voice', 'video', 'video_note', 'audio', 'document', 'sticker', 'animation'] as const;
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
  location: z.strictObject({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }).optional(),
  membership: z.enum(['blocked', 'unblocked']).optional(),
  inReplyTo: z.strictObject({ messageId: z.number().int(), text: str(L.replySnippet).optional() }).optional(),

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
  media: { type: MediaType; mimeType: string | null; fileName: string | null; durationSec: number | null; emoji: string | null } | null;
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
```

- [ ] **Step 2: Re-export** — append `export * from './interaction.js';` to `packages/shared/src/schemas/index.ts`.

- [ ] **Step 3: Verify** — `pnpm --filter @bookquest/shared build && pnpm --filter @bookquest/shared typecheck`. Expected: no errors. (`z.iso.datetime()` is Zod 4. If the installed version rejects it, use `z.string().datetime()`.)

- [ ] **Step 4: Commit** — `feat(shared): interaction schemas for the bot log`

---

### Task 2: API groundwork (shared helpers, constant-time token, env)

**Files:**
- Create: `apps/api/src/utils/crypto.ts`, `apps/api/src/utils/regex.ts`, `apps/api/src/utils/cursor.ts`
- Modify: `apps/api/src/utils/mongo.ts`, `apps/api/src/utils/time-zone.ts`, `apps/api/src/services/auth.services.ts`, `apps/api/src/services/admin.services.ts`, `apps/api/src/services/user.services.ts`, `apps/api/src/middlewares/bot-service.middleware.ts`, `apps/api/src/config/env.ts`, `.env.example`

- [ ] **Step 1: `utils/crypto.ts`** (move the two helpers out of `auth.services.ts`)

```ts
import { createHash, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Hashing both sides first gives equal lengths, so the compare leaks nothing about the length either. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}
```

In `auth.services.ts`, delete the local `sha256` and the `createHash, timingSafeEqual` import, import `safeEqual` from `../utils/crypto.js`, and change `isAdminPassword` to `return !!env.ADMIN_PASSWORD && safeEqual(password, env.ADMIN_PASSWORD);`.

- [ ] **Step 2: Constant-time bot token**: `bot-service.middleware.ts`

```ts
import { safeEqual } from '../utils/crypto.js';
// …
  if (!token || !safeEqual(token, env.BOT_SERVICE_TOKEN)) {
```

- [ ] **Step 3: `utils/regex.ts`**: move `escapeRegex` (with its comment) out of `admin.services.ts`, export it, and import it back into `admin.services.ts`.

- [ ] **Step 4: `utils/mongo.ts`**: add

```ts
/** `insertMany({ ordered: false })` throws even when every failure is a duplicate — a retried batch, which is success. */
export function isOnlyDuplicateKeyErrors(error: unknown): boolean {
  const raw = (error as { writeErrors?: unknown } | null)?.writeErrors;
  const list = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return (
    list.length > 0 &&
    list.every((e: { code?: number; err?: { code?: number } }) => (e.code ?? e.err?.code) === 11000)
  );
}
```

- [ ] **Step 5: `utils/time-zone.ts`**: add

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

// Noon UTC falls on the same calendar day in every zone within ±11 h, Tashkent included.
const noonUtc = (ymd: string): Date => new Date(`${ymd}T12:00:00Z`);

/** Midnight starting `ymd` (YYYY-MM-DD) in `timeZone`. */
export function dayStartIn(timeZone: string, ymd: string): Date {
  return startOfDayIn(timeZone, noonUtc(ymd));
}

/** Midnight ending `ymd` in `timeZone` — the exclusive upper bound of an inclusive day. */
export function dayEndIn(timeZone: string, ymd: string): Date {
  return startOfDayIn(timeZone, new Date(noonUtc(ymd).getTime() + DAY_MS));
}
```

- [ ] **Step 6: `utils/cursor.ts`**

```ts
import { Types } from 'mongoose';
import { z } from 'zod';
import { OBJECT_ID_PATTERN } from './mongo.js';

export interface Cursor {
  sentAt: Date;
  id: Types.ObjectId;
}

const cursorShape = z.object({ s: z.iso.datetime(), i: z.string().regex(OBJECT_ID_PATTERN) });

/** Opaque to clients: base64url JSON of the row's (sentAt, _id), the list's sort key. */
export function encodeCursor(sentAt: Date, id: Types.ObjectId): string {
  return Buffer.from(JSON.stringify({ s: sentAt.toISOString(), i: id.toHexString() })).toString('base64url');
}

export function decodeCursor(raw: string): Cursor | null {
  try {
    const parsed = cursorShape.safeParse(JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')));
    return parsed.success ? { sentAt: new Date(parsed.data.s), id: new Types.ObjectId(parsed.data.i) } : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 7: `isAdmin` takes a lean user.** In `user.services.ts`, widen the parameter so ingest can pass a `.lean()` row:

```ts
type AdminCheckable = Pick<UserDocument, 'telegramUserId' | 'role' | 'phoneNumber'>;

export function isAdmin(user: AdminCheckable): boolean {
```

- [ ] **Step 8: Env**: in `env.ts`, after `ORGANISER_TIME_ZONE`:

```ts
  /** How long bot interactions are kept. A TTL index enforces it; boot re-syncs the index if this changes. */
  INTERACTION_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(365),
```

In `.env.example`, under the API section:

```
# Days to keep messages users send the bot (admin Messages page). Default 365.
# INTERACTION_RETENTION_DAYS=365
```

- [ ] **Step 9: Verify**: `pnpm typecheck`. Then start the API and check that sign-in still works with an admin phone and the shared password. Run `curl -i -X POST localhost:4000/api/v1/bot/users -H 'X-Bot-Service-Token: wrong' -H 'Content-Type: application/json' -d '{}'`. Expected: `401`. Run it again with the real token and a valid body. Expected: `200`.

- [ ] **Step 10: Commit**: `refactor(api): shared crypto/regex/cursor helpers; constant-time bot token`

---

### Task 3: API: model, classification, ingest endpoint

**Files:**
- Create: `apps/api/src/models/bot-interaction.model.ts`, `apps/api/src/services/interaction-classify.services.ts`, `apps/api/src/services/interaction.services.ts`, `apps/api/src/scripts/reclassify-interactions.ts`
- Modify: `apps/api/src/db/connect.ts`, `apps/api/src/validators/bot.validators.ts`, `apps/api/src/controllers/bot.controllers.ts`, `apps/api/src/routes/bot.routes.ts`, `apps/api/src/app.ts`, `apps/api/package.json`

**Interfaces:**
- Consumes: `InteractionInput`, `botInteractionsBatchSchema` (Task 1), `isAdmin`, `isOnlyDuplicateKeyErrors` (Task 2).
- Produces: `BotInteractionModel`, `isSignal(item)`, `recordInteractions(items): Promise<number>`, and `POST /api/v1/bot/interactions` → `202 { ok: true, data: { accepted } }`.

- [ ] **Step 1: Model**: `models/bot-interaction.model.ts`

```ts
import { Schema, model, type InferSchemaType } from 'mongoose';
import { INTERACTION_KINDS, INTERACTION_LIMITS as L, MEDIA_TYPES } from '@bookquest/shared';
import { env } from '../config/env.js';

// Sub-schemas with no default: an absent part is omitted, not stored as null — small rows, clean partial indexes.
const sub = <T extends Record<string, unknown>>(shape: T) => new Schema(shape, { _id: false });

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
    from: { type: sub({ firstName: String, lastName: String, username: String, languageCode: String }), required: true },
    fromAdmin: { type: Boolean, default: false },

    chatId: String,
    chatType: String,
    messageId: Number,

    text: { type: String, maxlength: L.text },
    command: { type: String, maxlength: L.command },
    commandArgs: { type: String, maxlength: L.commandArgs },
    buttonLabel: { type: String, maxlength: L.buttonLabel },
    callbackData: { type: String, maxlength: L.callbackData },
    contact: sub({ phoneNumber: String, firstName: String, isOwn: Boolean }),
    media: sub({
      type: { type: String, enum: MEDIA_TYPES },
      fileId: String,
      fileUniqueId: String,
      mimeType: String,
      fileName: String,
      durationSec: Number,
      emoji: String
    }),
    location: sub({ lat: Number, lng: Number }),
    membership: { type: String, enum: ['blocked', 'unblocked'] },
    inReplyTo: sub({ messageId: Number, text: { type: String, maxlength: L.replySnippet } }),
    broadcast: { type: Schema.Types.ObjectId, ref: 'Broadcast', default: null },

    sentAt: { type: Date, required: true }
  },
  { timestamps: true, collection: 'bot_interactions' }
);

botInteractionSchema.index({ updateId: 1 }, { unique: true });
// Retention, and plain time order in both directions.
botInteractionSchema.index({ sentAt: 1 }, { expireAfterSeconds: env.INTERACTION_RETENTION_DAYS * 24 * 60 * 60 });
// The default "Messages" view.
botInteractionSchema.index({ signal: 1, sentAt: -1, _id: -1 });
// One person's timeline.
botInteractionSchema.index({ telegramUserId: 1, sentAt: -1, _id: -1 });
botInteractionSchema.index({ kind: 1, sentAt: -1 });
botInteractionSchema.index({ command: 1, sentAt: -1 }, { partialFilterExpression: { command: { $exists: true } } });
botInteractionSchema.index({ broadcast: 1, sentAt: -1 }, { partialFilterExpression: { broadcast: { $type: 'objectId' } } });

export type BotInteractionAttributes = InferSchemaType<typeof botInteractionSchema>;
export const BotInteractionModel = model('BotInteraction', botInteractionSchema);
```

(`broadcast` defaults to `null`, so its partial filter is `$type: 'objectId'`, not `$exists`. `$exists` would match the stored `null`s.)

- [ ] **Step 2: Sync indexes at boot**: in `db/connect.ts`, after `await UserModel.syncIndexes();`, add `await BotInteractionModel.syncIndexes();` with the import. A changed retention then rebuilds the TTL index instead of failing silently.

- [ ] **Step 3: Classification**: `services/interaction-classify.services.ts`

```ts
import type { InteractionInput } from '@bookquest/shared';

type Classifiable = Pick<InteractionInput, 'kind' | 'command' | 'commandArgs' | 'inReplyTo'>;

/**
 * "Signal": a person said or did something worth reading. Stored, not computed
 * at read time, so the default view is one indexed query; change a rule here,
 * then run `pnpm --filter @bookquest/api reclassify:interactions`.
 */
export function isSignal(item: Classifiable): boolean {
  if (item.inReplyTo) return true;
  switch (item.kind) {
    case 'text':
    case 'contact':
    case 'media':
    case 'location':
    case 'web_app_data':
      return true;
    case 'command':
      return item.command !== 'start' || !!item.commandArgs;
    default:
      return false;
  }
}
```

- [ ] **Step 4: Ingest service**: `services/interaction.services.ts` (the list and facets functions are added to this file in Task 5)

```ts
import type { Types } from 'mongoose';
import type { InteractionInput } from '@bookquest/shared';
import { adminTelegramIds } from '../config/env.js';
import { BotInteractionModel } from '../models/bot-interaction.model.js';
import { NotificationModel } from '../models/notification.model.js';
import { UserModel } from '../models/user.model.js';
import { isOnlyDuplicateKeyErrors } from '../utils/mongo.js';
import { isSignal } from './interaction-classify.services.js';
import { isAdmin } from './user.services.js';

/** A reply within this long after a broadcast is read as a reaction to it. */
const BROADCAST_WINDOW_MS = 72 * 60 * 60 * 1000;

type LeanUser = { _id: Types.ObjectId; telegramUserId?: string | null; role?: string | null; phoneNumber?: string | null };

/** POST /bot/interactions. Idempotent per updateId; returns how many items are now stored. */
export async function recordInteractions(items: InteractionInput[]): Promise<number> {
  const telegramIds = [...new Set(items.map((item) => item.telegramUserId))];
  const users = await UserModel.find(
    { telegramUserId: { $in: telegramIds } },
    { _id: 1, telegramUserId: 1, role: 1, phoneNumber: 1 }
  ).lean<LeanUser[]>();
  const userByTelegramId = new Map(users.map((user) => [user.telegramUserId!, user]));
  const broadcastFor = await recentBroadcastLookup(items, users);

  const docs = items.map((item) => {
    const user = userByTelegramId.get(item.telegramUserId);
    const sentAt = new Date(item.sentAt);
    return {
      ...item,
      sentAt,
      isEdit: item.isEdit ?? false,
      signal: isSignal(item),
      user: user?._id ?? null,
      fromAdmin: adminTelegramIds.has(item.telegramUserId) || (!!user && isAdmin(user)),
      broadcast: user ? broadcastFor(user._id, sentAt) : null
    };
  });

  await applyMembership(items);

  try {
    await BotInteractionModel.insertMany(docs, { ordered: false });
  } catch (error) {
    if (!isOnlyDuplicateKeyErrors(error)) throw error;
  }
  return docs.length;
}

/** One query per batch: each person's broadcasts in the window, newest first, matched in memory. */
async function recentBroadcastLookup(items: InteractionInput[], users: LeanUser[]) {
  if (users.length === 0) return () => null;
  const times = items.map((item) => Date.parse(item.sentAt));
  const notes = await NotificationModel.find(
    {
      user: { $in: users.map((user) => user._id) },
      kind: 'broadcast',
      createdAt: { $gte: new Date(Math.min(...times) - BROADCAST_WINDOW_MS), $lte: new Date(Math.max(...times)) }
    },
    { user: 1, broadcast: 1, createdAt: 1 }
  )
    .sort({ createdAt: -1 })
    .lean();

  const byUser = new Map<string, typeof notes>();
  for (const note of notes) {
    const key = String(note.user);
    byUser.set(key, [...(byUser.get(key) ?? []), note]);
  }

  return (userId: Types.ObjectId, sentAt: Date): Types.ObjectId | null => {
    const at = sentAt.getTime();
    const match = byUser
      .get(String(userId))
      ?.find((note) => note.createdAt.getTime() <= at && note.createdAt.getTime() >= at - BROADCAST_WINDOW_MS);
    return match?.broadcast ?? null;
  };
}

/** Block/unblock keeps `dmBlockedAt` true before the next broadcast finds out. Time-guarded so a late retry can't undo a newer state. */
async function applyMembership(items: InteractionInput[]): Promise<void> {
  const latest = new Map<string, InteractionInput>();
  for (const item of items) {
    if (!item.membership) continue;
    const seen = latest.get(item.telegramUserId);
    if (!seen || seen.sentAt < item.sentAt) latest.set(item.telegramUserId, item);
  }
  if (latest.size === 0) return;

  await UserModel.bulkWrite(
    [...latest.values()].map((item) => {
      const sentAt = new Date(item.sentAt);
      return item.membership === 'blocked'
        ? {
            updateOne: {
              filter: { telegramUserId: item.telegramUserId, $or: [{ dmBlockedAt: null }, { dmBlockedAt: { $lt: sentAt } }] },
              update: { $set: { dmBlockedAt: sentAt } }
            }
          }
        : {
            updateOne: {
              filter: { telegramUserId: item.telegramUserId, dmBlockedAt: { $lte: sentAt } },
              update: { $set: { dmBlockedAt: null } }
            }
          };
    }),
    { ordered: false }
  );
}
```

(`sentAt` strings are ISO-8601 UTC from the bot, so comparing them as strings orders them correctly.)

- [ ] **Step 5: Validator**: `validators/bot.validators.ts`: add

```ts
import { botInteractionsBatchSchema, botUserUpsertSchema } from '@bookquest/shared';
export const botInteractionsBody = botInteractionsBatchSchema;
```

- [ ] **Step 6: Controller**: `controllers/bot.controllers.ts`: add

```ts
import type { BotInteractionsBatch } from '@bookquest/shared';
import * as interactionService from '../services/interaction.services.js';

/** POST /api/v1/bot/interactions — apps/bot's batched log. 202: stored, nothing to return. */
export async function recordInteractions(req: Request, res: Response): Promise<void> {
  const { items } = req.body as BotInteractionsBatch;
  ok(res, { accepted: await interactionService.recordInteractions(items) }, 202);
}
```

- [ ] **Step 7: Route + body limit**
  - `routes/bot.routes.ts`: `botRoutes.post('/interactions', requireBotService, validate(botInteractionsBody), botController.recordInteractions);`
  - `app.ts`: directly **above** `app.use(express.json({ limit: '100kb' }));` add:

```ts
  // Bigger bodies for the bot's batches only. Must run before the global parser, which would 413 them first.
  app.use('/api/v1/bot/interactions', express.json({ limit: '256kb' }));
```

- [ ] **Step 8: Reclassify script**: `scripts/reclassify-interactions.ts`, plus `"reclassify:interactions": "tsx --env-file-if-exists=../../.env src/scripts/reclassify-interactions.ts"` in `apps/api/package.json`.

```ts
/** Recomputes `signal` after a rule change in interaction-classify. Idempotent; streams, so memory stays flat. */
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { BotInteractionModel } from '../models/bot-interaction.model.js';
import { isSignal } from '../services/interaction-classify.services.js';
import { logger } from '../config/logger.js';

async function run(): Promise<void> {
  await connectToDatabase();
  let changed = 0;
  const cursor = BotInteractionModel.find({}, { kind: 1, command: 1, commandArgs: 1, inReplyTo: 1, signal: 1 }).lean().cursor();
  for await (const row of cursor) {
    const signal = isSignal({
      kind: row.kind,
      command: row.command ?? undefined,
      commandArgs: row.commandArgs ?? undefined,
      inReplyTo: row.inReplyTo ? { messageId: row.inReplyTo.messageId ?? 0 } : undefined
    });
    if (signal === row.signal) continue;
    await BotInteractionModel.updateOne({ _id: row._id }, { $set: { signal } });
    changed += 1;
  }
  logger.info({ changed }, 'Reclassified interactions');
  await disconnectFromDatabase();
}

run().catch((error: unknown) => {
  logger.error({ err: error }, 'Reclassify failed');
  process.exit(1);
});
```

- [ ] **Step 9: Verify.** Run `pnpm typecheck`. Then, with the API running and `$T` set to `BOT_SERVICE_TOKEN` and `$ME` set to your Telegram id:

```bash
cat > /tmp/batch.json <<EOF
{"items":[
 {"updateId":900001,"updateType":"message","kind":"text","telegramUserId":"$ME","from":{"firstName":"Test"},"chatId":"$ME","chatType":"private","messageId":1,"text":"Kitob qachon chiqadi?","sentAt":"$(date -u +%FT%T.000Z)"},
 {"updateId":900002,"updateType":"message","kind":"command","telegramUserId":"$ME","from":{"firstName":"Test"},"command":"start","sentAt":"$(date -u +%FT%T.000Z)"},
 {"updateId":900003,"updateType":"my_chat_member","kind":"membership","telegramUserId":"$ME","from":{"firstName":"Test"},"membership":"blocked","sentAt":"$(date -u +%FT%T.000Z)"}
]}
EOF
curl -s -X POST localhost:4000/api/v1/bot/interactions -H "X-Bot-Service-Token: $T" -H 'Content-Type: application/json' --data @/tmp/batch.json
```

Expected:
  - `{"ok":true,"data":{"accepted":3}}` with status 202.
  - Running the same command again also returns 202, and the collection still holds 3 rows.
  - In `mongosh`: `db.bot_interactions.find({}, {kind:1, signal:1})` shows text → `signal: true`, plain `/start` → `false`, membership → `false`. Your `users` row has `dmBlockedAt` set.
  - Posting an `unblocked` item with a later `sentAt` clears `dmBlockedAt`.
  - An item with an extra key `"foo":1` → 400 (`“foo” is not something you can set here.`).
  - 101 items → 400.
  - A wrong token → 401.
  - A ~150 kb batch (100 items with 1,500-char texts) → 202, not 413.
  - The API log shows no message text for any of these requests.
  - Then delete the test rows: `db.bot_interactions.deleteMany({ updateId: { $gte: 900000 } })`.

- [ ] **Step 10: Commit**: `feat(api): bot interaction ingest — model, classification, POST /bot/interactions`

---

### Task 4: Bot: normaliser, recorder, middleware

**Files:**
- Create: `apps/bot/src/keyboards.ts`, `apps/bot/src/lib/interactions.ts`, `apps/bot/src/lib/interaction-recorder.ts`, `apps/bot/src/middlewares/record-interaction.ts`
- Modify: `apps/bot/src/lib/api-client.ts`, `apps/bot/src/bot.ts`

**Interfaces:**
- Consumes: `InteractionInput`, `INTERACTION_LIMITS`, `MediaType` (Task 1). `POST /bot/interactions` (Task 3).
- Produces: `toInteraction(update, botId): InteractionInput | null`, `recordInteraction(item)`, `flushInteractions(): Promise<void>`, `postInteractions(items): Promise<'ok' | 'retry' | 'drop'>`, and the `recordInteractionMiddleware` Telegraf middleware.

- [ ] **Step 1: `src/keyboards.ts`**

```ts
/**
 * Every reply-keyboard label the bot shows. A tapped reply-keyboard button
 * arrives as plain text, so this registry is the only way the log can tell a
 * tap from typing. Add each new label here, and use it from here.
 */
export const REPLY_KEYBOARD_LABELS: ReadonlySet<string> = new Set<string>([]);
```

- [ ] **Step 2: `src/lib/interactions.ts`** (pure, no I/O)

```ts
import type { InteractionInput, MediaType } from '@bookquest/shared';
import { INTERACTION_LIMITS as L } from '@bookquest/shared';
import type { InlineKeyboardMarkup, Message, Update, User } from 'telegraf/types';
import { REPLY_KEYBOARD_LABELS } from '../keyboards.js';

type Base = Omit<InteractionInput, 'kind'>;

const cap = (value: string, max: number): string => (value.length > max ? value.slice(0, max) : value);
const capOpt = (value: string | undefined, max: number): string | undefined =>
  value ? cap(value, max) : undefined;

function base(updateId: number, updateType: string, from: User, sentAt: Date, extra: Partial<Base> = {}): Base {
  return {
    updateId,
    updateType,
    telegramUserId: String(from.id),
    from: {
      firstName: cap(from.first_name, 128),
      lastName: capOpt(from.last_name, 128),
      username: capOpt(from.username, 64),
      languageCode: capOpt(from.language_code, 16)
    },
    sentAt: sentAt.toISOString(),
    ...extra
  };
}

/** Telegram update → one log row, or null for what isn't a person talking to the bot. */
export function toInteraction(update: Update, botId: number): InteractionInput | null {
  if ('message' in update) return fromMessage(update.update_id, 'message', update.message, botId, false);
  if ('edited_message' in update) return fromMessage(update.update_id, 'edited_message', update.edited_message, botId, true);
  if ('callback_query' in update) return fromCallback(update.update_id, update.callback_query);
  if ('my_chat_member' in update) return fromMembership(update.update_id, update.my_chat_member);

  const updateType = Object.keys(update).find((key) => key !== 'update_id') ?? 'unknown';
  const payload = (update as unknown as Record<string, { from?: User } | undefined>)[updateType];
  if (!payload?.from || payload.from.is_bot) return null;
  return { ...base(update.update_id, updateType, payload.from, new Date()), kind: 'other' };
}

function fromMessage(updateId: number, updateType: string, msg: Message, botId: number, isEdit: boolean): InteractionInput | null {
  // No `from` = a channel post; a bot sender is never a person.
  if (!msg.from || msg.from.is_bot) return null;
  const head = base(updateId, updateType, msg.from, new Date(msg.date * 1000), {
    chatId: String(msg.chat.id),
    chatType: msg.chat.type,
    messageId: msg.message_id,
    inReplyTo: replyContext(msg, botId),
    ...(isEdit ? { isEdit: true } : {})
  });

  if ('text' in msg) {
    const command = leadingCommand(msg);
    if (command) return { ...head, kind: 'command', ...command };
    if (REPLY_KEYBOARD_LABELS.has(msg.text)) {
      return { ...head, kind: 'button', buttonLabel: cap(msg.text, L.buttonLabel), text: cap(msg.text, L.text) };
    }
    return { ...head, kind: 'text', text: cap(msg.text, L.text) };
  }
  if ('contact' in msg) {
    return {
      ...head,
      kind: 'contact',
      contact: {
        phoneNumber: cap(msg.contact.phone_number, 32),
        firstName: capOpt(msg.contact.first_name, 128),
        isOwn: msg.contact.user_id === msg.from.id
      }
    };
  }
  const media = mediaOf(msg);
  if (media) return { ...head, kind: 'media', media, text: 'caption' in msg ? capOpt(msg.caption, L.text) : undefined };
  if ('venue' in msg) return { ...head, kind: 'location', location: { lat: msg.venue.location.latitude, lng: msg.venue.location.longitude } };
  if ('location' in msg) return { ...head, kind: 'location', location: { lat: msg.location.latitude, lng: msg.location.longitude } };
  if ('web_app_data' in msg) return { ...head, kind: 'web_app_data', text: cap(msg.web_app_data.data, L.text) };
  return { ...head, kind: 'other' };
}

function leadingCommand(msg: Message.TextMessage): Pick<InteractionInput, 'command' | 'commandArgs'> | null {
  const entity = msg.entities?.[0];
  if (!entity || entity.type !== 'bot_command' || entity.offset !== 0) return null;
  const command = msg.text.slice(1, entity.length).split('@')[0]!.toLowerCase();
  const args = msg.text.slice(entity.length).trim();
  return { command: cap(command, L.command), commandArgs: capOpt(args, L.commandArgs) };
}

// `animation` before `document`: an animation message carries both fields.
function mediaOf(msg: Message): InteractionInput['media'] | null {
  const file = (type: MediaType, f: { file_id: string; file_unique_id: string }, more: Partial<NonNullable<InteractionInput['media']>> = {}) => ({
    type,
    fileId: cap(f.file_id, 256),
    fileUniqueId: cap(f.file_unique_id, 128),
    ...more
  });
  if ('photo' in msg) {
    const largest = msg.photo.at(-1);
    return largest ? file('photo', largest) : null;
  }
  if ('animation' in msg) return file('animation', msg.animation, { mimeType: msg.animation.mime_type, fileName: capOpt(msg.animation.file_name, 256), durationSec: msg.animation.duration });
  if ('voice' in msg) return file('voice', msg.voice, { mimeType: msg.voice.mime_type, durationSec: msg.voice.duration });
  if ('video_note' in msg) return file('video_note', msg.video_note, { durationSec: msg.video_note.duration });
  if ('video' in msg) return file('video', msg.video, { mimeType: msg.video.mime_type, fileName: capOpt(msg.video.file_name, 256), durationSec: msg.video.duration });
  if ('audio' in msg) return file('audio', msg.audio, { mimeType: msg.audio.mime_type, fileName: capOpt(msg.audio.file_name, 256), durationSec: msg.audio.duration });
  if ('sticker' in msg) return file('sticker', msg.sticker, { emoji: capOpt(msg.sticker.emoji, 16) });
  if ('document' in msg) return file('document', msg.document, { mimeType: msg.document.mime_type, fileName: capOpt(msg.document.file_name, 256) });
  return null;
}

/** Filled only when the person used Telegram's Reply on one of *our* messages. */
function replyContext(msg: Message, botId: number): InteractionInput['inReplyTo'] {
  const reply = 'reply_to_message' in msg ? msg.reply_to_message : undefined;
  if (!reply || reply.from?.id !== botId) return undefined;
  const text = 'text' in reply ? reply.text : 'caption' in reply ? reply.caption : undefined;
  return { messageId: reply.message_id, text: capOpt(text, L.replySnippet) };
}

// A callback query has no `date`; receipt time is the closest truth.
function fromCallback(updateId: number, query: Update.CallbackQueryUpdate['callback_query']): InteractionInput | null {
  if (query.from.is_bot) return null;
  const data = 'data' in query ? query.data : undefined;
  const msg = query.message;
  const markup = msg && 'reply_markup' in msg ? msg.reply_markup : undefined;
  return {
    ...base(updateId, 'callback_query', query.from, new Date(), {
      chatId: msg ? String(msg.chat.id) : undefined,
      messageId: msg?.message_id
    }),
    kind: 'button',
    callbackData: capOpt(data, L.callbackData),
    buttonLabel: capOpt(data ? labelFor(markup, data) : undefined, L.buttonLabel)
  };
}

function labelFor(markup: InlineKeyboardMarkup | undefined, data: string): string | undefined {
  return markup?.inline_keyboard.flat().find((button) => 'callback_data' in button && button.callback_data === data)?.text;
}

/** Private chats only, and only real transitions: a first-time member isn't an "unblock". */
function fromMembership(updateId: number, change: Update.MyChatMemberUpdate['my_chat_member']): InteractionInput | null {
  if (change.chat.type !== 'private' || change.from.is_bot) return null;
  const now = change.new_chat_member.status;
  const was = change.old_chat_member.status;
  const membership = now === 'kicked' ? 'blocked' : now === 'member' && was === 'kicked' ? 'unblocked' : null;
  if (!membership) return null;
  return { ...base(updateId, 'my_chat_member', change.from, new Date(change.date * 1000), { chatId: String(change.chat.id), chatType: 'private' }), kind: 'membership', membership };
}
```

(If a typegram name differs in the installed version, for example `Message.TextMessage` or `Update.CallbackQueryUpdate`, take the equivalent from `telegraf/types`. The narrowing with `in` is what matters.)

- [ ] **Step 3: `api-client.ts`**: add

```ts
import type { InteractionInput } from '@bookquest/shared';

const INTERACTIONS_TIMEOUT_MS = 5000;

/** Never throws. 'drop' = the API refused the batch itself (4xx); retrying can't help. Logs counts and status only. */
export async function postInteractions(items: InteractionInput[]): Promise<'ok' | 'retry' | 'drop'> {
  try {
    const response = await fetch(`${env.API_BASE_URL}/bot/interactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Bot-Service-Token': env.BOT_SERVICE_TOKEN },
      body: JSON.stringify({ items }),
      signal: AbortSignal.timeout(INTERACTIONS_TIMEOUT_MS)
    });
    if (response.ok) return 'ok';
    logger.warn({ status: response.status, count: items.length }, 'Interaction batch not accepted');
    return response.status >= 400 && response.status < 500 && response.status !== 429 ? 'drop' : 'retry';
  } catch (error) {
    logger.warn({ err: error, count: items.length }, 'API unreachable for interaction batch');
    return 'retry';
  }
}
```

- [ ] **Step 4: `src/lib/interaction-recorder.ts`**

```ts
import { INTERACTION_LIMITS, type InteractionInput } from '@bookquest/shared';
import { logger } from '../config/logger.js';
import { postInteractions } from './api-client.js';

const FLUSH_EVERY_MS = 2000;
const FLUSH_AT = 50;
/** A long API outage must not grow memory without limit: past this, the oldest go. */
const BUFFER_CAP = 1000;
const RETRY_AFTER_MS = 2000;

let buffer: InteractionInput[] = [];
let timer: NodeJS.Timeout | null = null;
let inFlight: Promise<void> | null = null;
let dropped = 0;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Synchronous and cheap: called from the middleware on every update. */
export function recordInteraction(item: InteractionInput): void {
  buffer.push(item);
  if (buffer.length > BUFFER_CAP) {
    const over = buffer.length - BUFFER_CAP;
    buffer.splice(0, over);
    dropped += over;
  }
  if (buffer.length >= FLUSH_AT) void flushInteractions();
  else schedule();
}

function schedule(): void {
  if (timer) return;
  timer = setTimeout(() => void flushInteractions(), FLUSH_EVERY_MS);
  // Never the reason the process stays alive.
  timer.unref();
}

/** One flush at a time; callers during a flush share it. Anything recorded meanwhile gets the next one. */
export function flushInteractions(): Promise<void> {
  inFlight ??= drain().finally(() => {
    inFlight = null;
    if (buffer.length > 0) schedule();
  });
  return inFlight;
}

async function drain(): Promise<void> {
  if (timer) clearTimeout(timer);
  timer = null;
  if (dropped > 0) {
    logger.warn({ dropped }, 'Interaction buffer full; dropped the oldest');
    dropped = 0;
  }
  while (buffer.length > 0) {
    const batch = buffer.splice(0, INTERACTION_LIMITS.batch);
    let outcome = await postInteractions(batch);
    if (outcome === 'retry') {
      await sleep(RETRY_AFTER_MS);
      outcome = await postInteractions(batch);
    }
    if (outcome !== 'ok') logger.warn({ count: batch.length, outcome }, 'Dropped an interaction batch');
  }
}
```

- [ ] **Step 5: `src/middlewares/record-interaction.ts`**

```ts
import type { Context, MiddlewareFn } from 'telegraf';
import { logger } from '../config/logger.js';
import { toInteraction } from '../lib/interactions.js';
import { recordInteraction } from '../lib/interaction-recorder.js';

/** First in the chain, so every update is seen even when no handler matches. A bug here logs and moves on. */
export const recordInteractionMiddleware: MiddlewareFn<Context> = async (ctx, next) => {
  try {
    const item = toInteraction(ctx.update, ctx.botInfo.id);
    if (item) recordInteraction(item);
  } catch (error) {
    logger.warn({ err: error, updateId: ctx.update.update_id }, 'Could not record interaction');
  }
  await next();
};
```

- [ ] **Step 6: Wire into `bot.ts`**
  - Import `recordInteractionMiddleware` and `flushInteractions`.
  - Directly after `await bot.telegram.setMyCommands([]);`, add `bot.use(recordInteractionMiddleware);` with the comment `// First: logging sees every update, matched or not.`
  - Replace `shutdown`:

```ts
  const SHUTDOWN_FLUSH_MS = 3000;
  // Stop polling first so nothing is recorded after the last flush; bounded so a dead API can't hold the exit.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    bot.stop(signal);
    void Promise.race([flushInteractions(), new Promise((resolve) => setTimeout(resolve, SHUTDOWN_FLUSH_MS))]).finally(() =>
      process.exit(0)
    );
  };
```

  - Replace the launch call:

```ts
  // Explicit: Telegram reuses the last caller's allowed_updates otherwise, which may lack my_chat_member.
  await bot.launch(
    { allowedUpdates: ['message', 'edited_message', 'callback_query', 'my_chat_member'] },
    () => logger.info('BookQuest bot listening (long polling)')
  );
```

- [ ] **Step 7: Logging rule check**: `grep -rn "text\|caption\|contact\|callbackData\|commandArgs" apps/bot/src --include=*.ts | grep logger`. Expected: no matches.

- [ ] **Step 8: Typecheck**: `pnpm typecheck`.

- [ ] **Step 9: Verify against the real bot** (API from Task 3 running locally, bot pointed at it):
  - Send `/start`. Expected: the welcome and the button arrive exactly as before, with no added delay. Within about 2 s a row appears with `kind: 'command', command: 'start', signal: false`.
  - Send `/start ref_xyz` (open `t.me/<bot>?start=ref_xyz`). Expected: `commandArgs: 'ref_xyz'`, `signal: true`.
  - Send plain text. Expected: `kind: 'text'`, and the fallback reply still arrives.
  - Use Telegram's Reply on the bot's "Tap below…" message. Expected: `inReplyTo.text` holds that message's text.
  - Share your contact (📎 → Contact). Expected: `kind: 'contact', contact.isOwn: true`.
  - Send a photo with a caption. Expected: `media.type: 'photo'`, `text` is the caption.
  - Send a GIF. Expected: `media.type: 'animation'`, not `document`.
  - Send a voice note and a location. Expected: `voice` and `location` rows.
  - Edit a sent text. Expected: a second row with `isEdit: true`.
  - Block the bot, then unblock it. Expected: `membership: 'blocked'` and then `'unblocked'`, and `users.dmBlockedAt` is set and then cleared.
  - Stop the API and send three texts. Expected: replies still arrive, and the bot logs `API unreachable…`, then `Dropped an interaction batch` with counts only. Restart the API.
  - Ctrl-C the bot right after sending a text. Expected: that row still lands, because of the shutdown flush.
  - The bot log shows no message content anywhere.

- [ ] **Step 10: Commit**: `feat(bot): record every update the bot receives, batched to the API`

---

### Task 5: API: admin list and facets endpoints

**Files:**
- Create: `apps/api/src/controllers/admin/interaction.controllers.ts`, `apps/api/src/routes/admin/interaction.routes.ts`
- Modify: `apps/api/src/services/interaction.services.ts`, `apps/api/src/validators/admin.validators.ts`, `apps/api/src/routes/admin/index.ts`

**Interfaces:**
- Consumes: `BotInteractionModel` (Task 3), `escapeRegex`, `encodeCursor`/`decodeCursor`, `dayStartIn`/`dayEndIn` (Task 2), `auditAdmin`.
- Produces:
  - `GET /api/v1/admin/interactions` → `InteractionList`
  - `GET /api/v1/admin/interactions/facets` → `InteractionFacets`

- [ ] **Step 1: Validators**: `admin.validators.ts`: add

```ts
import { INTERACTION_KINDS } from '@bookquest/shared';
import { decodeCursor } from '../utils/cursor.js';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date like 2026-11-09.');
const flag = z.enum(['true', 'false']).transform((value) => value === 'true');
const cursorParam = z
  .string()
  .max(200)
  .transform((raw, ctx) => {
    const cursor = decodeCursor(raw);
    if (!cursor) {
      ctx.addIssue({ code: 'custom', message: 'That list position is no longer valid. Reload the page.' });
      return z.NEVER;
    }
    return cursor;
  });
const kinds = z
  .string()
  .max(200)
  .transform((raw) => raw.split(',').map((kind) => kind.trim()).filter(Boolean))
  .pipe(z.array(z.enum(INTERACTION_KINDS)));

export const adminInteractionQuery = z.object({
  view: z.enum(['messages', 'all']).default('messages'),
  kind: kinds.optional(),
  person: z.string().regex(/^\d{1,20}$/, 'That is not a Telegram id.').optional(),
  q: z.string().trim().max(80).optional(),
  command: z.string().trim().toLowerCase().max(64).optional(),
  broadcast: objectId.optional(),
  hasContact: flag.optional(),
  includeAdmins: flag.default(false),
  from: day.optional(),
  to: day.optional(),
  order: z.enum(['newest', 'oldest']).default('newest'),
  cursor: cursorParam.optional(),
  since: cursorParam.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50)
});
export type AdminInteractionQuery = z.output<typeof adminInteractionQuery>;

export const adminInteractionFacetsQuery = z.object({
  from: day.optional(),
  to: day.optional(),
  includeAdmins: flag.default(false)
});
export type AdminInteractionFacetsQuery = z.output<typeof adminInteractionFacetsQuery>;
```

- [ ] **Step 2: Service**: append to `interaction.services.ts`

```ts
import { Types, type FilterQuery } from 'mongoose';
import type { Interaction, InteractionFacets, InteractionKind, InteractionList, PersonSummary } from '@bookquest/shared';
import { INTERACTION_KINDS } from '@bookquest/shared';
import { env } from '../config/env.js';
import { BroadcastModel } from '../models/broadcast.model.js';
import type { BotInteractionAttributes } from '../models/bot-interaction.model.js';
import type { AdminInteractionFacetsQuery, AdminInteractionQuery } from '../validators/admin.validators.js';
import { encodeCursor, type Cursor } from '../utils/cursor.js';
import { escapeRegex } from '../utils/regex.js';
import { dayEndIn, dayStartIn } from '../utils/time-zone.js';

type Row = BotInteractionAttributes & { _id: Types.ObjectId };
const SNIPPET = 80;

function rangeFilter(from?: string, to?: string): FilterQuery<Row> {
  if (!from && !to) return {};
  return {
    sentAt: {
      ...(from ? { $gte: dayStartIn(env.ORGANISER_TIME_ZONE, from) } : {}),
      ...(to ? { $lt: dayEndIn(env.ORGANISER_TIME_ZONE, to) } : {})
    }
  };
}

// Rows strictly after (newer) or before (older) a cursor, in (sentAt, _id) order.
function beyond(cursor: Cursor, direction: 'older' | 'newer'): FilterQuery<Row> {
  const op = direction === 'older' ? '$lt' : '$gt';
  return { $or: [{ sentAt: { [op]: cursor.sentAt } }, { sentAt: cursor.sentAt, _id: { [op]: cursor.id } }] };
}

function buildFilter(query: AdminInteractionQuery): FilterQuery<Row> {
  const and: FilterQuery<Row>[] = [rangeFilter(query.from, query.to)];
  if (query.view === 'messages') and.push({ signal: true });
  if (query.hasContact) and.push({ kind: 'contact' });
  else if (query.kind?.length) and.push({ kind: { $in: query.kind } });
  if (query.person) and.push({ telegramUserId: query.person });
  // Organisers testing the bot are noise — except on one person's own timeline.
  else if (!query.includeAdmins) and.push({ fromAdmin: false });
  if (query.command) and.push({ command: query.command });
  if (query.broadcast) and.push({ broadcast: new Types.ObjectId(query.broadcast) });

  const term = query.q?.trim();
  if (term) {
    const rx = { $regex: escapeRegex(term.replace(/^@/, '')), $options: 'i' };
    and.push({
      $or: [
        { text: rx },
        { buttonLabel: rx },
        { 'from.firstName': rx },
        { 'from.lastName': rx },
        { 'from.username': rx },
        ...(/^\d+$/.test(term) ? [{ telegramUserId: term }] : [])
      ]
    });
  }
  return { $and: and.filter((part) => Object.keys(part).length > 0) };
}

export async function listInteractions(query: AdminInteractionQuery): Promise<InteractionList> {
  const newestFirst = query.order === 'newest';
  const filter = buildFilter(query);
  const sort = newestFirst ? { sentAt: -1, _id: -1 } as const : { sentAt: 1, _id: 1 } as const;

  // `since` (the new-rows poll) ignores order and cursor: newer than the reader's top row, newest first.
  if (query.since) filter.$and!.push(beyond(query.since, 'newer'));
  else if (query.cursor) filter.$and!.push(beyond(query.cursor, newestFirst ? 'older' : 'newer'));

  const rows = await BotInteractionModel.find(filter)
    .sort(query.since ? { sentAt: -1, _id: -1 } : sort)
    .limit(query.limit + 1)
    .lean<Row[]>();

  const page = rows.slice(0, query.limit);
  const last = page.at(-1);
  const first = page[0];
  const snippets = await broadcastSnippets(page);
  const firstPage = !query.cursor && !query.since;

  return {
    items: page.map((row) => toInteractionDto(row, snippets)),
    nextCursor: !query.since && rows.length > query.limit && last ? encodeCursor(last.sentAt, last._id) : null,
    headCursor: first ? encodeCursor(first.sentAt, first._id) : null,
    ...(query.person && firstPage ? { person: await personSummary(query.person) } : {})
  };
}

async function broadcastSnippets(rows: Row[]): Promise<Map<string, string>> {
  const ids = [...new Set(rows.flatMap((row) => (row.broadcast ? [String(row.broadcast)] : [])))];
  if (ids.length === 0) return new Map();
  const broadcasts = await BroadcastModel.find({ _id: { $in: ids } }, { message: 1 }).lean();
  return new Map(broadcasts.map((b) => [String(b._id), b.message.length > SNIPPET ? `${b.message.slice(0, SNIPPET)}…` : b.message]));
}

function toInteractionDto(row: Row, snippets: Map<string, string>): Interaction {
  const broadcastId = row.broadcast ? String(row.broadcast) : null;
  return {
    id: String(row._id),
    kind: row.kind as InteractionKind,
    signal: row.signal,
    isEdit: row.isEdit ?? false,
    telegramUserId: row.telegramUserId,
    userId: row.user ? String(row.user) : null,
    from: { firstName: row.from.firstName ?? '', lastName: row.from.lastName ?? null, username: row.from.username ?? null },
    fromAdmin: row.fromAdmin ?? false,
    text: row.text ?? null,
    command: row.command ?? null,
    commandArgs: row.commandArgs ?? null,
    buttonLabel: row.buttonLabel ?? null,
    callbackData: row.callbackData ?? null,
    contact: row.contact
      ? { phoneNumber: row.contact.phoneNumber ?? '', firstName: row.contact.firstName ?? null, isOwn: !!row.contact.isOwn }
      : null,
    // fileId stays server-side until media preview exists.
    media: row.media
      ? { type: row.media.type as NonNullable<Interaction['media']>['type'], mimeType: row.media.mimeType ?? null, fileName: row.media.fileName ?? null, durationSec: row.media.durationSec ?? null, emoji: row.media.emoji ?? null }
      : null,
    location: row.location ? { lat: row.location.lat ?? 0, lng: row.location.lng ?? 0 } : null,
    membership: (row.membership as Interaction['membership']) ?? null,
    inReplyTo: row.inReplyTo ? { messageId: row.inReplyTo.messageId ?? 0, text: row.inReplyTo.text ?? null } : null,
    broadcast: broadcastId ? { id: broadcastId, snippet: snippets.get(broadcastId) ?? '' } : null,
    sentAt: row.sentAt.toISOString()
  };
}

async function personSummary(telegramUserId: string): Promise<PersonSummary> {
  const [user, totals, latest, ownContact] = await Promise.all([
    UserModel.findOne({ telegramUserId }, { firstName: 1, lastName: 1, username: 1, phoneNumber: 1, dmBlockedAt: 1 }).lean(),
    BotInteractionModel.aggregate<{ total: number; first: Date; last: Date }>([
      { $match: { telegramUserId } },
      { $group: { _id: null, total: { $sum: 1 }, first: { $min: '$sentAt' }, last: { $max: '$sentAt' } } }
    ]),
    BotInteractionModel.findOne({ telegramUserId }, { from: 1 }).sort({ sentAt: -1 }).lean<Row>(),
    BotInteractionModel.findOne({ telegramUserId, kind: 'contact', 'contact.isOwn': true }, { contact: 1 }).sort({ sentAt: -1 }).lean<Row>()
  ]);
  const stats = totals[0];
  return {
    telegramUserId,
    userId: user ? String(user._id) : null,
    firstName: user?.firstName ?? latest?.from.firstName ?? 'Unknown',
    lastName: user?.lastName ?? latest?.from.lastName ?? null,
    username: user?.username ?? latest?.from.username ?? null,
    phoneNumber: user?.phoneNumber ?? ownContact?.contact?.phoneNumber ?? null,
    firstSeenAt: stats ? stats.first.toISOString() : null,
    lastSeenAt: stats ? stats.last.toISOString() : null,
    total: stats?.total ?? 0,
    blocked: !!user?.dmBlockedAt
  };
}

export async function getFacets(query: AdminInteractionFacetsQuery): Promise<InteractionFacets> {
  const match = { ...rangeFilter(query.from, query.to), ...(query.includeAdmins ? {} : { fromAdmin: false }) };
  const [byKind, byCommand] = await Promise.all([
    BotInteractionModel.aggregate<{ _id: InteractionKind; count: number }>([
      { $match: match },
      { $group: { _id: '$kind', count: { $sum: 1 } } }
    ]),
    BotInteractionModel.aggregate<{ _id: string; count: number }>([
      { $match: { ...match, command: { $exists: true } } },
      { $group: { _id: '$command', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 50 }
    ])
  ]);
  const kinds = Object.fromEntries(INTERACTION_KINDS.map((kind) => [kind, 0])) as Record<InteractionKind, number>;
  for (const { _id, count } of byKind) kinds[_id] = count;
  return { kinds, commands: byCommand.map(({ _id, count }) => ({ command: _id, count })) };
}
```

(If `FilterQuery` isn't exported by the installed Mongoose 9 typings, use `QueryFilter` or a plain `Record<string, unknown>`. The shape is what matters.)

- [ ] **Step 3: Controller**: `controllers/admin/interaction.controllers.ts`

```ts
import type { Request, Response } from 'express';
import * as interactionService from '../../services/interaction.services.js';
import type { AdminInteractionFacetsQuery, AdminInteractionQuery } from '../../validators/admin.validators.js';
import { auditAdmin } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';

const NOT_FILTERS = new Set(['cursor', 'since', 'limit', 'order', 'view', 'includeAdmins']);

/** GET /api/v1/admin/interactions */
export async function listInteractions(req: Request, res: Response): Promise<void> {
  const query = req.query as unknown as AdminInteractionQuery;
  // First page only: load-more and the 30 s poll would otherwise audit every half minute.
  if (!query.cursor && !query.since) {
    const filterKeys = Object.entries(query).flatMap(([key, value]) => (value !== undefined && !NOT_FILTERS.has(key) ? [key] : []));
    auditAdmin(req, 'interactions.list', { view: query.view, filterKeys });
  }
  ok(res, await interactionService.listInteractions(query));
}

/** GET /api/v1/admin/interactions/facets */
export async function getFacets(req: Request, res: Response): Promise<void> {
  ok(res, await interactionService.getFacets(req.query as unknown as AdminInteractionFacetsQuery));
}
```

- [ ] **Step 4: Routes**: `routes/admin/interaction.routes.ts`

```ts
import { Router } from 'express';
import * as controller from '../../controllers/admin/interaction.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { adminInteractionFacetsQuery, adminInteractionQuery } from '../../validators/admin.validators.js';

export const adminInteractionRoutes: Router = Router();

adminInteractionRoutes.get('/facets', validate(adminInteractionFacetsQuery, 'query'), controller.getFacets);
adminInteractionRoutes.get('/', validate(adminInteractionQuery, 'query'), controller.listInteractions);
```

In `routes/admin/index.ts`: import it and add `adminRoutes.use('/interactions', adminInteractionRoutes);`.

- [ ] **Step 5: Verify.** Run `pnpm typecheck`. Seed some rows with Task 3's curl, using fresh `updateId`s and a mix of kinds, about 120 rows so paging shows. Then, with `$A` an admin bearer token:
  - `GET /admin/interactions` with no token → 401. With a non-admin token → 403.
  - The default → only `signal: true` rows, newest first, 50 items, `nextCursor` set, `headCursor` set.
  - Following `nextCursor` until it is `null` → no row repeats (check that the ids are unique), and the total equals the signal count in Mongo.
  - `view=all` includes `/start` and membership rows. `order=oldest` reverses them.
  - `kind=contact,media`, `hasContact=true`, `command=start`, `person=<id>` (the response includes `person` with `total`, `blocked`, `phoneNumber`), `q=@user`, `q=<id digits>` and `q=qachon` each filter as named.
  - `q=.*(` → 200, no error, treated as literal.
  - `from=2026-11-09&to=2026-11-09` → only rows from that Tashkent day.
  - `cursor=garbage` → 400 `That list position is no longer valid…`. `limit=101` → 400. `kind=nope` → 400.
  - `since=<headCursor>` → `[]`. Insert one new row, then the same call → that row.
  - `includeAdmins=false` hides rows from an `ADMIN_TELEGRAM_IDS` id, and `true` shows them.
  - `/admin/interactions/facets` → counts per kind plus a `start` command count.
  - The API log shows one `Admin action interactions.list` line per first-page call, with filter **keys** and no values.

- [ ] **Step 6: Commit**: `feat(api): admin interactions list (cursor pages, filters) and facets`

---

### Task 6: Web: data layer and mock

**Files:**
- Create: `apps/web/src/features/admin/interactions/filters.ts`, `apps/web/src/features/admin/api/useAdminInteractions.ts`, `apps/web/src/lib/api/mock/interactions.ts`
- Modify: `apps/web/src/features/admin/api/adminKeys.ts`, `apps/web/src/lib/format.ts`, `apps/web/src/lib/api/mock/routes.ts`

**Interfaces:**
- Produces:
  - `InteractionFilters` type, `DEFAULT_FILTERS`, `readFilters(params)`, `writeFilters(filters)`, `toQueryParams(filters)`, `RANGE_OPTIONS`.
  - `useAdminInteractions(filters, limit?)` (infinite), `useNewInteractionCount(filters, headCursor)`, `useInteractionFacets(filters)`.
  - `formatTimeAgo(iso, now?)`.

- [ ] **Step 1: `adminKeys.ts`**: add

```ts
  interactions: (params: object) => [...adminKeys.all, 'interactions', 'list', params] as const,
  interactionsNew: (params: object) => [...adminKeys.all, 'interactions', 'new', params] as const,
  interactionFacets: (params: object) => [...adminKeys.all, 'interactions', 'facets', params] as const
```

- [ ] **Step 2: `interactions/filters.ts`**

```ts
import type { InteractionKind } from '@bookquest/shared';
import { INTERACTION_KINDS } from '@bookquest/shared';

/** Must match the API's ORGANISER_TIME_ZONE default: ranges are whole organiser days. */
export const ORGANISER_TIME_ZONE = 'Asia/Tashkent';
const DAY_MS = 24 * 60 * 60 * 1000;
const YMD = new Intl.DateTimeFormat('en-CA', { timeZone: ORGANISER_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' });

export const RANGE_OPTIONS = [
  { value: 'today', label: 'Today' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: 'all', label: 'All time' }
] as const;
export type RangePreset = (typeof RANGE_OPTIONS)[number]['value'];
const BACK_DAYS: Record<Exclude<RangePreset, 'all'>, number> = { today: 0, '7d': 6, '30d': 29 };

export interface InteractionFilters {
  view: 'messages' | 'all';
  q: string;
  kind: InteractionKind | '';
  command: string;
  broadcast: string;
  range: RangePreset;
  includeAdmins: boolean;
  person: string;
  order: 'newest' | 'oldest';
}

export const DEFAULT_FILTERS: InteractionFilters = {
  view: 'messages', q: '', kind: '', command: '', broadcast: '', range: '7d', includeAdmins: false, person: '', order: 'newest'
};

const oneOf = <T extends string>(value: string | null, allowed: readonly T[], fallback: T): T =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;

/** URL → filters. Unknown values fall back to defaults rather than breaking the page. */
export function readFilters(params: URLSearchParams): InteractionFilters {
  return {
    view: oneOf(params.get('view'), ['messages', 'all'], DEFAULT_FILTERS.view),
    q: params.get('q') ?? '',
    kind: oneOf(params.get('kind'), ['', ...INTERACTION_KINDS], ''),
    command: params.get('command') ?? '',
    broadcast: params.get('broadcast') ?? '',
    range: oneOf(params.get('range'), RANGE_OPTIONS.map((o) => o.value), DEFAULT_FILTERS.range),
    includeAdmins: params.get('organisers') === '1',
    person: params.get('person') ?? '',
    order: oneOf(params.get('order'), ['newest', 'oldest'], DEFAULT_FILTERS.order)
  };
}

/** Filters → URL, defaults omitted so a clean view has a clean URL. */
export function writeFilters(filters: InteractionFilters): Record<string, string> {
  const out: Record<string, string> = {};
  if (filters.view !== DEFAULT_FILTERS.view) out.view = filters.view;
  if (filters.q) out.q = filters.q;
  if (filters.kind) out.kind = filters.kind;
  if (filters.command) out.command = filters.command;
  if (filters.broadcast) out.broadcast = filters.broadcast;
  if (filters.range !== DEFAULT_FILTERS.range) out.range = filters.range;
  if (filters.includeAdmins) out.organisers = '1';
  if (filters.person) out.person = filters.person;
  if (filters.order !== DEFAULT_FILTERS.order) out.order = filters.order;
  return out;
}

export function rangeFrom(range: RangePreset, now = new Date()): string | null {
  return range === 'all' ? null : YMD.format(new Date(now.getTime() - BACK_DAYS[range] * DAY_MS));
}

/** Filters → API query. `from` is a date string, so the cache key rolls over at organiser midnight. */
export function toQueryParams(filters: InteractionFilters): Record<string, string> {
  const params: Record<string, string> = { view: filters.view, order: filters.order };
  const from = rangeFrom(filters.range);
  if (from) params.from = from;
  if (filters.q) params.q = filters.q;
  if (filters.kind) params.kind = filters.kind;
  if (filters.command) params.command = filters.command;
  if (filters.broadcast) params.broadcast = filters.broadcast;
  if (filters.includeAdmins) params.includeAdmins = 'true';
  if (filters.person) params.person = filters.person;
  return params;
}

export function hasActiveFilters(filters: InteractionFilters): boolean {
  return Object.keys(writeFilters({ ...filters, view: DEFAULT_FILTERS.view, order: DEFAULT_FILTERS.order })).length > 0;
}
```

- [ ] **Step 3: `api/useAdminInteractions.ts`**

```ts
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type { InteractionFacets, InteractionList } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { rangeFrom, toQueryParams, type InteractionFilters } from '../interactions/filters';
import { adminKeys } from './adminKeys';

const NEW_POLL_MS = 30_000;

/** Cursor pages: new rows land on top while the organiser scrolls, which would shift numbered pages. */
export function useAdminInteractions(filters: InteractionFilters, limit = 50) {
  const params = { ...toQueryParams(filters), limit: String(limit) };
  return useInfiniteQuery({
    queryKey: adminKeys.interactions(params),
    queryFn: ({ pageParam }) => {
      const search = new URLSearchParams(params);
      if (pageParam) search.set('cursor', pageParam);
      return api.get<InteractionList>(`/admin/interactions?${search.toString()}`);
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
    placeholderData: keepPreviousData
  });
}

/** Counts rows newer than the top one. Polls only while the tab is visible (React Query's default). */
export function useNewInteractionCount(filters: InteractionFilters, headCursor: string | null) {
  const params = { ...toQueryParams(filters), since: headCursor ?? '', limit: '100' };
  return useQuery({
    queryKey: adminKeys.interactionsNew(params),
    queryFn: () => api.get<InteractionList>(`/admin/interactions?${new URLSearchParams(params).toString()}`),
    enabled: headCursor !== null && filters.order === 'newest',
    refetchInterval: NEW_POLL_MS,
    select: (data) => data.items.length
  });
}

export function useInteractionFacets(filters: InteractionFilters) {
  const from = rangeFrom(filters.range);
  const params: Record<string, string> = { ...(from ? { from } : {}), ...(filters.includeAdmins ? { includeAdmins: 'true' } : {}) };
  return useQuery({
    queryKey: adminKeys.interactionFacets(params),
    queryFn: () => api.get<InteractionFacets>(`/admin/interactions/facets?${new URLSearchParams(params).toString()}`),
    staleTime: 60_000
  });
}
```

- [ ] **Step 4: `formatTimeAgo` in `lib/format.ts`**

```ts
const MINUTE_MS = 60_000;

/** "just now", "12 min ago", "3 h ago" inside a day; the compact date past that. Exact time goes in a `title`. */
export function formatTimeAgo(value: string | Date, now = new Date()): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  if (minutes < 24 * 60) return `${Math.floor(minutes / 60)} h ago`;
  return formatCompactDate(date);
}
```

- [ ] **Step 5: Mock**: `lib/api/mock/interactions.ts`. About 40 fixture rows covering every kind, two people with several rows each, one admin row, two rows linked to a broadcast, and one `inReplyTo`. Generate them deterministically relative to `Date.now()` (minutes to days ago). The module exports two route handlers:
  - `adminInteractions(context)` applies `view`, `kind`, `person`, `q` (case-insensitive over text, buttonLabel and names), `includeAdmins`, `order`, `since` and `cursor`. Its cursor is the base64 of the row index; the client treats it as opaque. It returns `InteractionList` (with `person` when `person` is set, on the first page).
  - `adminInteractionFacets()` returns counts from the fixtures.
  - Both call the existing `requireAdmin(context)`. Export it from `routes.ts`, or pass it in, whichever fits the file.

  Register both in `routes.ts`, **literal path first**:

```ts
  { method: 'GET', path: '/admin/interactions/facets', handle: adminInteractionFacets },
  { method: 'GET', path: '/admin/interactions', handle: adminInteractions },
```

- [ ] **Step 6: Verify.** Run `pnpm typecheck`. Then start `VITE_MOCK_API=true pnpm --filter @bookquest/web dev` and run `window.mockApi.setRole('admin')`. In DevTools, a manual `fetch` to `/admin/interactions` returns the mock list. (The real check is the page in Task 7.)

- [ ] **Step 7: Commit**: `feat(web): admin interactions data layer, URL filters, mock`

---

### Task 7: Web: Messages page, nav and redirect

**Files:**
- Create: `apps/web/src/features/admin/components/CopyButton.tsx`, `apps/web/src/features/admin/interactions/KindChip.tsx`, `InteractionContent.tsx`, `InteractionsTable.tsx`, `InteractionFilters.tsx`, `PersonSheet.tsx`, `MessagesPage.tsx`
- Modify: `apps/web/src/features/admin/components/ContactLink.tsx`, `apps/web/src/features/admin/screens.ts`, `apps/web/src/app/router.tsx`, `apps/web/src/layouts/AdminLayout.tsx`, `apps/web/src/styles/shell.css`

**Interfaces:**
- Consumes: everything from Task 6. `Sheet`, `Switch`, `Select`, `SearchInput`, `Button`, `EmptyState`, `AdminScreen`, `AdminPageHeader`, `AdminQuery`, `ContactLink`, `useBroadcasts`, `useDebouncedValue`, `openTelegramLink`.

- [ ] **Step 1: `CopyButton`**: move the copy logic out of `ContactLink` (same toast copy, same 36 px hit area). Then use it in `ContactLink`.

```tsx
import { Copy } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';

export function CopyButton({ value, label }: { value: string; label: string }) {
  const showToast = useUiStore((state) => state.showToast);
  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showToast('Copied.');
    } catch {
      showToast("Couldn't copy. Long-press to select it.");
    }
  }
  return (
    <button type="button" aria-label={label} onClick={() => void copy()} className="grid h-9 w-9 shrink-0 place-items-center text-taupe hover:text-paper">
      <Copy aria-hidden className="h-4 w-4" />
    </button>
  );
}
```

  In `ContactLink`, replace the inline `copy` function and its `<button>` with `<CopyButton value={contact.value} label={`Copy ${contact.value}`} />`.

- [ ] **Step 2: `KindChip.tsx`**

```tsx
import type { InteractionKind } from '@bookquest/shared';

export const KIND_LABEL: Record<InteractionKind, string> = {
  text: 'Text', command: 'Command', button: 'Button', contact: 'Contact', media: 'Media',
  location: 'Location', web_app_data: 'App data', membership: 'Access', other: 'Other'
};

// Gold for what a person wrote or shared; quiet for machine-ish events.
const LOUD = new Set<InteractionKind>(['text', 'contact', 'media', 'location']);

export function KindChip({ kind }: { kind: InteractionKind }) {
  return (
    <span className={`inline-flex rounded-full border px-2 py-0.5 text-xs ${LOUD.has(kind) ? 'border-gold/40 text-gold' : 'border-[color:var(--rule)] text-taupe'}`}>
      {KIND_LABEL[kind]}
    </span>
  );
}
```

- [ ] **Step 3: `InteractionContent.tsx`**: one renderer for both table rows and phone cards. Plain text only.

```tsx
import type { Interaction } from '@bookquest/shared';
import { CornerDownRight } from 'lucide-react';

const MEDIA_LABEL: Record<NonNullable<Interaction['media']>['type'], string> = {
  photo: 'Photo', voice: 'Voice message', video: 'Video', video_note: 'Video note', audio: 'Audio',
  document: 'File', sticker: 'Sticker', animation: 'GIF'
};

function body(item: Interaction): string {
  switch (item.kind) {
    case 'text': return item.text ?? '';
    case 'command': return `/${item.command ?? ''}${item.commandArgs ? ` ${item.commandArgs}` : ''}`;
    case 'button': return item.buttonLabel ?? item.callbackData ?? 'Button';
    case 'contact': return `${item.contact?.phoneNumber ?? ''}${item.contact?.isOwn ? ' (own number)' : item.contact?.firstName ? ` (${item.contact.firstName})` : ''}`;
    case 'media': {
      const m = item.media;
      const label = m ? `${m.emoji ? `${m.emoji} ` : ''}${MEDIA_LABEL[m.type]}${m.fileName ? ` · ${m.fileName}` : ''}${m.durationSec ? ` · ${m.durationSec}s` : ''}` : 'Media';
      return item.text ? `${label} — ${item.text}` : label;
    }
    case 'location': return item.location ? `📍 ${item.location.lat.toFixed(4)}, ${item.location.lng.toFixed(4)}` : 'Location';
    case 'web_app_data': return item.text ?? '';
    case 'membership': return item.membership === 'blocked' ? 'Blocked the bot' : 'Unblocked the bot';
    default: return 'Other update';
  }
}

/** React escapes text: whatever people typed renders as text, links included, never as markup. */
export function InteractionContent({ item }: { item: Interaction }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <p className="m-0 whitespace-pre-wrap break-words text-paper">
        {body(item)}
        {item.isEdit && <span className="ml-2 text-xs text-taupe">(edited)</span>}
      </p>
      {item.inReplyTo?.text && (
        <p className="m-0 flex gap-1 text-xs text-taupe"><CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0" />Replying to “{item.inReplyTo.text}”</p>
      )}
      {!item.inReplyTo && item.broadcast && (
        <p className="m-0 flex gap-1 text-xs text-taupe"><CornerDownRight aria-hidden className="h-3.5 w-3.5 shrink-0" />After broadcast “{item.broadcast.snippet}”</p>
      )}
    </div>
  );
}
```

- [ ] **Step 4: `InteractionsTable.tsx`**: the same dual rendering as `ParticipantsTable` (cards below `sm`, a table from `sm`), plus a sentinel that loads the next page.
  - `PersonCell({ item, onOpen })`: the full name (`from.firstName from.lastName`) as a text button that calls `onOpen(item.telegramUserId)`, then `@username` when present, then the id shortened to 5 digits plus `…`, with `<CopyButton value={id} label="Copy Telegram id" />`. An `Organiser` tag appears when `fromAdmin`.
  - The time cell is `<time dateTime={sentAt} title={formatLongDate(sentAt)}>{formatTimeAgo(sentAt)}</time>`. The `title` shows the exact time on hover. On touch, a long-press on the row reveals it, because the phone card prints the `formatLongDate` value under the relative one.
  - Table columns: Time · Person · Kind · Content (context lines live inside `InteractionContent`). Use `min-w-[44rem]` and `table-fixed`, with the Content column taking the remaining width.
  - Phone card: person and time on the top line, the chip, then `InteractionContent`.
  - Sentinel: an `IntersectionObserver` on a `div` after the list (`rootMargin: '400px'`). It calls `onLoadMore` when `hasMore && !isLoadingMore`. A visible `Button variant="quiet"` labelled `Load more` sits in the same place for keyboards and for browsers that block the observer. While loading, `Loading more…` shows.

```tsx
interface InteractionsTableProps {
  items: Interaction[];
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onOpenPerson: (telegramUserId: string) => void;
}
```

- [ ] **Step 5: `InteractionFilters.tsx`**: the toolbar. It is controlled: it takes `filters` and `onChange(partial)`, plus the local `searchInput` / `onSearchInput` pair, and the `personName` used for the person chip.
  - Row 1: `<Switch aria-label="Which rows" options={[{value:'messages',label:'Messages'},{value:'all',label:'Everything'}]} …/>` and a `SearchInput` with placeholder `Name, @user, id or text`, `maxLength={80}`.
  - Row 2 (wraps on phones, never scrolls sideways):
    - `Select` Kind: `All kinds` plus each of `KIND_LABEL`, with the facet count in the label (`Text · 42`).
    - `Select` Command: `All commands` plus `facets.commands` (`/start · 310`).
    - `Select` Broadcast: `Any broadcast` plus `useBroadcasts().data.items` (first 40 chars of `message`, plus its date).
    - `Select` Range: `RANGE_OPTIONS`.
    - A checkbox `Show organisers`.
    - `Select` Order: `Newest first` / `Oldest first`.
  - When `filters.person` is set: a removable chip `Only {personName} ×` that calls `onChange({ person: '' })`.
  - `Select` needs a `label`. Use short visible labels (`Kind`, `Command`, `Broadcast`, `When`, `Order`), the same pattern as the other admin forms.

- [ ] **Step 6: `PersonSheet.tsx`**: a `Sheet` titled with the person's name. It runs `useAdminInteractions({ ...DEFAULT_FILTERS, view: 'all', range: 'all', includeAdmins: true, person: id }, 30)` and renders:
  - The summary from `pages[0].person`:
    - `@username`, the id with `CopyButton`, and the phone via `ContactLink` (`{ method: 'phone', value }`) when there is one.
    - `First seen {formatLongDate}` · `Last seen {formatTimeAgo}` · `{formatCount(total)} interactions`.
    - `Blocked the bot` in a muted warning tone when `blocked`.
  - Actions (primary last):
    - `Show in list` calls `onFilter(id)` and closes the sheet.
    - `Open chat in Telegram` uses `ContactLink` with `{ method: 'telegram', value: '@'+username }`, shown only when there is a username. Otherwise the line reads `No @username — they can only be reached by a bot reply.`
  - The timeline: the same `InteractionsTable` (cards at every width inside the sheet: pass a `compact` prop that forces the card layout), with load-more.
  - Props: `{ telegramUserId: string | null; onClose; onFilter }`. The sheet is open when `telegramUserId !== null`, and the query is `enabled` only then. To keep the hook unconditional, pass `person: telegramUserId ?? ''` and add an `enabled` option to `useAdminInteractions` (defaults to `true`).

- [ ] **Step 7: `MessagesPage.tsx`**

```tsx
import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { adminKeys } from '../api/adminKeys';
import { useAdminInteractions, useInteractionFacets, useNewInteractionCount } from '../api/useAdminInteractions';
import { DEFAULT_FILTERS, hasActiveFilters, readFilters, toQueryParams, writeFilters, RANGE_OPTIONS, type InteractionFilters } from './filters';
import { InteractionFiltersBar } from './InteractionFilters';
import { InteractionsTable } from './InteractionsTable';
import { PersonSheet } from './PersonSheet';

const SEARCH_DEBOUNCE_MS = 350;
const LIMIT = 50;

/** `/admin/messages` — what people say to the bot. Filters live in the URL: refresh, Back and shared links keep the view. */
export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const filters = useMemo(() => readFilters(searchParams), [searchParams]);
  const [searchInput, setSearchInput] = useState(filters.q);
  const q = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const [openPerson, setOpenPerson] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const update = (patch: Partial<InteractionFilters>) =>
    setSearchParams(writeFilters({ ...filters, ...patch }), { replace: true });

  useEffect(() => {
    if (q !== filters.q) update({ q });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the debounced value drives this
  }, [q]);

  const list = useAdminInteractions(filters, LIMIT);
  const facets = useInteractionFacets(filters);
  const headCursor = list.data?.pages[0]?.headCursor ?? null;
  const newCount = useNewInteractionCount(filters, headCursor).data ?? 0;

  // Reset, not refetch: refetching cursor pages after page 1 grew would duplicate rows at the seams.
  const showNew = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void queryClient.resetQueries({ queryKey: adminKeys.interactions({ ...toQueryParams(filters), limit: String(LIMIT) }), exact: true });
  };

  const personName = list.data?.pages[0]?.person?.firstName ?? 'this person';

  return (
    <AdminScreen>
      <div className="flex flex-col gap-3">
        <AdminPageHeader
          title="Messages"
          titleClassName="text-4xl"
          actions={newCount > 0 ? <Button variant="quiet" onClick={showNew}>● {newCount >= 100 ? '99+' : newCount} new</Button> : undefined}
        />
        <InteractionFiltersBar
          filters={filters}
          onChange={update}
          searchInput={searchInput}
          onSearchInput={setSearchInput}
          facets={facets.data}
          personName={personName}
        />
      </div>
      <AdminQuery query={list} loadingLabel="Reading the inbox…">
        {(data) => {
          const items = data.pages.flatMap((page) => page.items);
          if (items.length === 0) return <Empty filters={filters} personName={personName} onClear={() => { setSearchInput(''); setSearchParams({}, { replace: true }); }} />;
          return (
            <div className={`flex flex-1 flex-col transition-opacity duration-150 ${list.isPlaceholderData ? 'opacity-60' : ''}`}>
              <InteractionsTable items={items} hasMore={list.hasNextPage} isLoadingMore={list.isFetchingNextPage} onLoadMore={() => void list.fetchNextPage()} onOpenPerson={setOpenPerson} />
            </div>
          );
        }}
      </AdminQuery>
      <PersonSheet telegramUserId={openPerson} onClose={() => setOpenPerson(null)} onFilter={(person) => update({ person })} />
    </AdminScreen>
  );
}

/** Says which filter emptied the list, so "nothing here" is never a mystery. */
function Empty({ filters, personName, onClear }: { filters: InteractionFilters; personName: string; onClear: () => void }) {
  const what = filters.view === 'messages' ? 'messages' : 'activity';
  const who = filters.person ? ` from ${personName}` : '';
  const when = filters.range === 'all' ? '' : ` ${RANGE_OPTIONS.find((o) => o.value === filters.range)?.label.toLowerCase()}`;
  const filtered = hasActiveFilters(filters) && (filters.q || filters.kind || filters.command || filters.broadcast);
  return (
    <EmptyState
      title={`No ${what}${who}${when}`}
      titleAs="h2"
      body={filtered ? 'Some filters are narrowing this down.' : filters.view === 'messages' ? 'Switch to Everything to see /start taps and button presses too.' : undefined}
      className="flex-1"
      action={hasActiveFilters(filters) || filters.view !== DEFAULT_FILTERS.view ? <Button variant="quiet" onClick={onClear}>Clear filters</Button> : undefined}
    />
  );
}
```

  (`today` reads `No messages today` because the preset label is lower-cased.)

- [ ] **Step 8: Wire up**
  - `screens.ts`: `export { MessagesPage } from './interactions/MessagesPage';`
  - `router.tsx`:
    - Inside the admin children: `{ path: 'messages', ...adminScreen('MessagesPage') },`
    - Top-level, next to the other redirects: `{ path: '/all-usermessages', element: <Navigate to="/admin/messages" replace /> },` with the comment `// The URL first asked for; the page lives under /admin for the guard and the admin chunk.`
  - `AdminLayout.tsx`: import `MessageSquare` and add `{ to: '/admin/messages', label: 'Messages', icon: MessageSquare }` after Broadcast. Update the comment's "five" to "six".
  - `shell.css` `.tabbar`: replace `grid-template-columns: repeat(5, 1fr);` with

```css
  /* Any number of tabs: the participant bar has five, admin six. */
  grid-auto-flow: column;
  grid-auto-columns: minmax(0, 1fr);
```

- [ ] **Step 9: Verify in the browser.** Run `pnpm typecheck`. Then check in mock mode (`VITE_MOCK_API=true`, `mockApi.setRole('admin')`), and once against the real API from Tasks 3–5:
  - `/all-usermessages` → `/admin/messages`. Signed out → the admin guard. As a participant → `ForbiddenState`.
  - Default view: no plain `/start` rows. `Everything` shows them.
  - Each filter changes the URL. Refresh and Back restore it, and a copied URL opened in a new tab shows the same view.
  - Typing in search fires one request about 350 ms after the last keystroke (Network tab).
  - Scroll to the bottom: `Loading more…` appears, then more rows, with no duplicate-key warnings in the console.
  - Insert a new row (mock: `window.mockApi` addition, or real: send the bot a text). Within 30 s `● 1 new` appears and the list doesn't move. Tapping it scrolls to the top with the row present and no duplicates. In a background tab, the Network tab shows no polling.
  - Tap a person: the sheet shows the summary, timeline and actions. `Show in list` adds the `Only {name} ×` chip, and × removes it.
  - A message containing `<b>hi</b> https://example.com` renders literally, with no bold and no link.
  - The empty state names the filter (`No messages from Aziza last 7 days`), and `Clear filters` resets the view.
  - **360 px and 390 px wide** (DevTools device mode): no horizontal page scroll. Rows render as cards. All six tab labels in the admin bar are readable. The participant tab bar still has five even columns.
  - Desktop ≥ 900 px: the floating pill tab bar holds six tabs.

- [ ] **Step 10: Commit**: `feat(web): admin Messages page — filters in the URL, person sheet, new-rows pill`

---

### Task 8: Spec sync and final pass

**Files:**
- Modify: `docs/superpowers/specs/2026-11-09-bot-interaction-log-design.md` (only if implementation differed)

- [ ] **Step 1:** In the spec, note the refinements listed at the top of this plan that changed visible behaviour: `headCursor`/`since`, the audit on first page only, stop-then-flush on shutdown, and the time-guarded membership update.
- [ ] **Step 2:** Run `pnpm typecheck` and `pnpm build` across the monorepo. Both must pass.
- [ ] **Step 3:** Run `grep -rn "logger\.\(info\|warn\|error\)" apps/bot/src apps/api/src/services/interaction*.ts apps/api/src/controllers/admin/interaction.controllers.ts` and read each call. None may pass message content.
- [ ] **Step 4:** Rollout order (spec §6): deploy the API (Tasks 2, 3 and 5) → deploy the bot (Task 4) → deploy the web app (Tasks 6–7). The bot can go live before the page: rows accumulate from the first deploy.
- [ ] **Step 5: Commit**: `docs(spec): sync interaction-log spec with the implementation`
