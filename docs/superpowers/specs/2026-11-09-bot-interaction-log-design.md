# Bot Interaction Log — Design

**Goal:** record everything users send to the bot (messages, commands, button taps, shared
contacts, media, block/unblock) and give organisers one clean, filterable, admin-only page to read it,
so they can see what people are actually trying to say and respond to them.

**Why now:** people reply to broadcasts and news in the bot chat. Today the bot answers them with
"Everything happens inside the app now" and the message disappears. New bot buttons and commands are
coming too, and their usage should be visible from day one.

**Anti-goals (would make this a failure even if it works):**
- Logging slows down or breaks the bot's replies. Recording must never block a reply or raise an
  error the user can see.
- The page is noise-first. The default view must show what people *said*, not 500 `/start` rows.
- Message content leaks: into server logs, to non-admins, or through a guessable unprotected URL.

**Out of scope (v1):** tracking taps inside the Mini App (a separate product-analytics feature with
its own spec), replying from the page, downloading media files, CSV export. See *Later*.

---

## What the bot can and can't see

This is the most important constraint on the feature.

| Interaction | Reaches the bot? |
|---|---|
| Typed text, `/commands`, `/start <payload>` deep links | Yes, a `message` update |
| Inline-keyboard button with `callback_data` | Yes, a `callback_query` update |
| Reply-keyboard button | Yes, but it arrives as **plain text** that matches the button label |
| Shared contact, photo, voice, video, sticker, document, location | Yes, a `message` update |
| User blocks or unblocks the bot | Yes, a `my_chat_member` update |
| "📖 Open BookQuest" (`web_app` button) and any tap inside the Mini App | **No.** Telegram opens the webview directly |

So "every click" here means every click *the bot receives*. Today that is mostly `/start` and free
text. As bot buttons are added they get logged automatically, with nothing to change in this feature
(see the reply-keyboard rule in §2).

---

## 1. Architecture

```
Telegram ──update──▶ apps/bot
                       │  bot.use(recordInteraction)   ← first middleware: normalise, buffer, next()
                       │  … existing handlers reply as before
                       ▼  batched every 2 s / 50 items
                  POST /api/v1/bot/interactions   (X-Bot-Service-Token)
                       ▼
                  apps/api: validate → classify → link user + broadcast → insertMany
                       ▼
                  Mongo `bot_interactions`
                       ▲
GET /api/v1/admin/interactions  (requireUser + requireAdmin, inherited from /admin mount)
                       ▲
apps/web  /admin/messages
```

**Decisions and why:**
- **The bot never touches the database.** It reports through the existing bot-service channel,
  the same way `upsertUser` does (Approach A in the bot/Mini App spec). One write path, one place to
  validate.
- **The bot normalises, the API classifies.** The bot knows Telegram's shapes (Telegraf types). The
  API owns the meaning: what counts as noise, which broadcast a reply belongs to, who is an admin.
  Changing a rule is then one API change, never a bot redeploy.
- **Batched, fire-and-forget.** A broadcast to 1,000+ people can bring a burst of replies, and
  one HTTP call per update would hammer the API at exactly that moment.

---

## 2. Bot side (`apps/bot`)

### Files
- `src/middlewares/record-interaction.ts`: Telegraf middleware. Calls `toInteraction(ctx.update)`,
  hands the result to the recorder, then `await next()`. It is registered **first** in `bot.ts`, so
  every update is seen even if no handler matches. Wrapped in try/catch: a normalisation bug logs
  and moves on.
- `src/lib/interactions.ts`: the pure `toInteraction(update) → InteractionInput | null` normaliser.
- `src/lib/interaction-recorder.ts`: an in-memory buffer that flushes over HTTP.
- `src/lib/api-client.ts`: gains `postInteractions(items)`, built like `upsertUser`: never throws,
  has a timeout, and logs status only.

### Normalisation (`toInteraction`)

| Update | `kind` | Fields filled |
|---|---|---|
| `message` with a leading `bot_command` entity | `command` | `command` (no slash, no `@botname`, lowercased), `commandArgs` (the rest, e.g. the `/start` payload) |
| `message.text`, which equals a known reply-keyboard label | `button` | `buttonLabel`, `text` |
| `message.text` (otherwise) | `text` | `text` |
| `callback_query` | `button` | `callbackData`, `buttonLabel` (looked up in `callback_query.message.reply_markup.inline_keyboard` by matching `callback_data`) |
| `message.contact` | `contact` | `contact.{phoneNumber, firstName, isOwn}` (`isOwn` = `contact.user_id === from.id`) |
| `message.photo/voice/video/video_note/audio/document/sticker/animation` | `media` | `media.{type, fileId, fileUniqueId, mimeType?, fileName?, durationSec?, emoji?}`, `text` = caption |
| `message.location/venue` | `location` | `location.{lat, lng}` |
| `message.web_app_data` | `web_app_data` | `text` = `data` (capped) |
| `my_chat_member` | `membership` | `membership` = `blocked` \| `unblocked` (from `new_chat_member.status` `kicked` vs `member`) |
| `edited_message` | same kind as the original | `isEdit: true` |
| anything else | `other` | `updateType` only |

Every item also carries: `updateId`, `updateType`, `telegramUserId` (string, as everywhere else in the
repo), a `from` snapshot (`firstName`, `lastName`, `username`, `languageCode`), `chatId`,
`chatType`, `messageId`, `sentAt` (Telegram's `date`, not arrival time), and `inReplyTo`
(`{ messageId, text }`, filled when the user used Telegram's *Reply* on one of the bot's messages,
text capped at 280 chars).

**Reply-keyboard rule:** a `src/keyboards.ts` registry exports every reply-keyboard label the bot
uses. The normaliser checks typed text against it. This is the only way to tell a tapped
reply-keyboard button from typed text, and it means future buttons are classified correctly as long
as their labels live in that registry.

Updates with no `from` (channel posts) return `null` and are skipped.

### Recorder
- Flush when the buffer reaches **50 items** or every **2 s**, whichever comes first.
- Buffer cap **1,000**. Past that, drop the oldest and log a count, never the content. A long API
  outage must not grow memory without limit.
- On a failed flush, retry once after 2 s. If that fails too, drop the batch and log
  `{ count, status }`. Losing a few log rows is acceptable. Blocking the bot is not.
- `shutdown()` in `bot.ts` awaits one last flush (bounded at 3 s) before `bot.stop()`.

### Logging rule
Bot logs never include `text`, `contact`, captions or `callbackData`. They include ids and counts
only. Message content lives in one place: the database, behind admin auth.

---

## 3. API side (`apps/api`)

### Model: `models/bot-interaction.model.ts` → collection `bot_interactions`

*My call on naming:* the request said a `user_messages` table, but the collection also holds button
taps, contacts and block events, so `bot_interactions` describes it more truthfully. The page itself
is still titled "Messages".

```ts
{
  updateId:       Number,  required  // Telegram's id: makes retries idempotent
  updateType:     String,  required
  kind:           String,  enum KINDS, required
  signal:         Boolean, required  // "real" content, see Classification
  isEdit:         Boolean, default false

  telegramUserId: String,  required
  user:           ObjectId ref User, default null   // resolved at ingest; null if unknown yet
  from:           { firstName, lastName, username, languageCode }  // snapshot: names change
  fromAdmin:      Boolean, default false

  chatId: String, chatType: String, messageId: Number

  text:           String  (≤ 4096)
  command:        String  (≤ 64),  commandArgs: String (≤ 256)
  buttonLabel:    String  (≤ 128), callbackData: String (≤ 64)
  contact:        { phoneNumber, firstName, isOwn }
  media:          { type, fileId, fileUniqueId, mimeType, fileName, durationSec, emoji }
  location:       { lat, lng }
  membership:     'blocked' | 'unblocked'
  inReplyTo:      { messageId, text }
  broadcast:      ObjectId ref Broadcast, default null

  sentAt:         Date, required
}  // + timestamps (createdAt = received)
```

Absent sub-documents are omitted, not stored as `null`. That keeps rows small and partial
indexes clean, the same lesson as the `telegramUserId` index on `User`.

**Indexes**
- `{ updateId: 1 }` unique. A retried batch can't double-insert.
- `{ sentAt: 1 }` with TTL `expireAfterSeconds` from `INTERACTION_RETENTION_DAYS` (default **365**, my
  call). It also serves plain time sorting in both directions.
- `{ signal: 1, sentAt: -1, _id: -1 }`: the default view.
- `{ telegramUserId: 1, sentAt: -1, _id: -1 }`: one person's timeline.
- `{ kind: 1, sentAt: -1 }`, `{ command: 1, sentAt: -1 }` (partial: `command` exists),
  `{ broadcast: 1, sentAt: -1 }` (partial: `broadcast` exists).

### Classification (`services/interaction-classify.services.ts`)
One pure function, `isSignal(item)`. "Signal" means a human said or did something worth reading:

| Signal ✅ | Noise ❌ |
|---|---|
| `text`, `contact`, `media`, `location`, `web_app_data` | `button` (callback or reply-keyboard) |
| `command` **with** args (e.g. `/start ref_xyz`) or any command other than `start` | plain `/start` |
| anything with `inReplyTo` | `membership`, `other` |

The flag is stored, not computed at read time, so the default view is a plain indexed query. If the
rules change, a one-off script recomputes it (`scripts/reclassify-interactions.ts`). The "Everything"
view ignores the flag, so nothing is ever hidden for good.

### Enrichment at ingest
For each batch:
1. **User:** a single `UserModel.find({ telegramUserId: { $in } })` sets `user` and
   `fromAdmin = isAdmin(user)`. Unknown ids stay `user: null`, and the `from` snapshot still
   identifies them.
2. **Broadcast link:** for each user, find their most recent `Notification` with `kind: 'broadcast'`
   created within **72 h** before `sentAt` (my call). A match sets `broadcast`. This answers "was this
   a reaction to news?" without the user having to press *Reply*. Done as one aggregation per batch,
   not per item.
3. **Membership side effect:** a `blocked` event sets `User.dmBlockedAt` and `unblocked` clears it,
   so broadcasts stop retrying people who blocked the bot before the next send even finds out.
4. `insertMany(items, { ordered: false })`, ignoring duplicate-key errors via `isDuplicateKeyError`.

### Endpoints

**`POST /bot/interactions`**, in `bot.routes.ts`: `requireBotService` → `validate(botInteractionsBody)`
→ controller → `interaction.services.recordInteractions`.
- Body: `{ items: InteractionInput[] }`, 1–100 items. Every string has a max length (table above), and
  the Zod schema is `.strict()`, so unknown keys are rejected.
- Route-level `express.json({ limit: '256kb' })`.
- Responds `202 { accepted: n }`.

**`GET /admin/interactions`**, in a new `routes/admin/interaction.routes.ts` mounted in
`routes/admin/index.ts`. Admin auth comes from the mount, as with every admin route.

| Param | Meaning |
|---|---|
| `view` | `messages` (default, `signal: true`) \| `all` |
| `kind` | comma list of kinds |
| `person` | a `telegramUserId` |
| `q` | case-insensitive search across `text`, `buttonLabel`, `from.firstName/lastName/username`, plus exact `telegramUserId`. Escaped with `escapeRegex`, capped at 80 chars |
| `command` | exact command |
| `broadcast` | a broadcast id (`OBJECT_ID_PATTERN`) |
| `hasContact` | `true`: only `kind: contact` rows |
| `includeAdmins` | default `false` (organisers testing the bot are hidden) |
| `from`, `to` | ISO dates (inclusive day bounds in Tashkent time, via `utils/time-zone.ts`) |
| `order` | `newest` (default) \| `oldest` |
| `cursor`, `limit` | `limit` 1–100, default 50 |

**Cursor, not page numbers** (my call; this differs from participants on purpose). New rows
arrive at the top while an organiser scrolls, which would shift numbered pages and show
duplicates. The cursor is an opaque base64 of `{ sentAt, _id }`, decoded and validated with Zod.

Response: `{ items: Interaction[], nextCursor: string | null, person?: PersonSummary }`. `person`
is present only when `person=` is set: profile, the phone from `User` (if any), first/last
interaction, total count and blocked status. That's everything the person sheet needs in one call.

**`GET /admin/interactions/facets?from&to`**: the distinct `command` values with counts, plus counts
per `kind`, for the chosen range. This drives the filter dropdown, so new commands appear there on
their own.

### Shared (`packages/shared`)
`schemas/interaction.ts`: the `INTERACTION_KINDS` const, `interactionInput` (bot → API),
`Interaction` DTO, `InteractionList`, `InteractionFacets` and `PersonSummary`. Bot, API and web all
import from here, the same as `bot.ts` and `participant.ts` do today.

### Reuse
Move `escapeRegex` out of `admin.services.ts` into `utils/regex.ts`. The participants search and
this one then share it.

---

## 4. Web (`apps/web`)

### Route
`/admin/messages`, under the existing `RequireAdmin` + lazy `AdminLayout` block, with a
"Messages" entry in the admin nav. `/all-usermessages` stays as a top-level
`<Navigate to="/admin/messages" replace />`, so the URL you asked for works.

*Why not a standalone top-level page:* under `/admin` it inherits the guard, the shell and the
admins-only code chunk (`da578b2`) by position, so nothing has to be remembered. A different URL
doesn't make the page more private. The API's `requireAdmin` is what keeps it private, and it
applies either way.

### Layout

```
Messages                                           ● 3 new   (pill, click → scroll top + merge)
[ Messages | Everything ]   [Search name, @user, id, text…]
[Kind ▾] [Command ▾] [Broadcast ▾] [Last 7 days ▾] [☐ Show organisers]      Newest ▾

TIME        PERSON                     KIND        CONTENT
14:02       Aziza Karimova             Text        "Kitob qachon chiqadi?"
            @aziza · 51234…  ⧉                      ↩ after broadcast "Yangi kitob…"
13:58       Bekzod T. · 7712…  ⧉       Contact     +998 90 123 45 12   (own number)
…                              [ infinite scroll, “Loading more…” ]
```

- **Columns:** Time (relative for <24 h, absolute on hover/long-press), Person (full name,
  `@username` if any, `tg_id` with copy), Kind (small coloured chip), Content (text / button label /
  `/command args` / contact / media type + caption / "blocked the bot"), Context (↩ broadcast
  snippet, or the quoted reply).
- **Phone width:** organisers open admin in the Mini App, so rows collapse into cards (person +
  time on top, content below). No horizontal scroll.
- **Person sheet:** tapping a person opens the existing `Sheet` with their `PersonSummary` and full
  timeline (same list, `person=` set). Actions: "Open chat in Telegram" (`t.me/<username>` when
  there is one), copy id, and `ContactLink` for their phone. The person filter also shows as a
  removable chip in the toolbar.
- **Command and Broadcast** dropdowns fill from `/facets` and the existing broadcasts list.
- **Content is rendered as plain text** (React escapes it). No `dangerouslySetInnerHTML`, no
  auto-linking. Users can type anything, including links you shouldn't click by accident.
- **Empty states** say which filter emptied the list ("No messages from Aziza in the last 7 days"),
  with a one-tap "Clear filters".

### State and data
- Every filter lives in the URL search params (the same pattern as participants): refresh, Back and a
  shared link all keep the view. The search input is debounced (350 ms, `useDebouncedValue`).
- `features/admin/api/useAdminInteractions.ts`: `useInfiniteQuery` keyed by
  `adminKeys.interactions(filters)`, `placeholderData: keepPreviousData` (old rows dim while new
  ones load, as on participants).
- **"New" pill, not auto-jumping:** every 30 s (only while the tab is visible) a lightweight
  query fetches rows newer than the top row and shows "● N new". Tapping merges them in. The list
  never shifts under the reader's thumb.
- Components in `features/admin/interactions/`: `MessagesPage`, `InteractionFilters`,
  `InteractionsTable` (desktop rows and phone cards share one `InteractionContent` renderer),
  `KindChip`, `PersonSheet`.

---

## 5. Security and privacy

| Risk | Control |
|---|---|
| Someone posts fake interactions | `requireBotService`. **Fix in passing:** compare the token with `crypto.timingSafeEqual` instead of `!==` (a timing leak on a shared secret) |
| Oversized or malformed batches | strict Zod schema, per-field caps, 100 items max, 256 kb body limit |
| Non-admin reads | `/admin` mount guard. The web guard is UX only |
| Regex injection / slow regex in search | `escapeRegex` + 80-char cap |
| Content in logs | bot and API log ids, counts and statuses only, never `text`/`contact`/captions |
| Stored XSS via message text | plain-text rendering only |
| Data kept forever | TTL index (`INTERACTION_RETENTION_DAYS`, default 365) |
| Admin access unaccounted for | `auditAdmin(req, 'interactions.list', { filterKeys })` on each list call: which filters, never their values, same as existing audit lines |

**Before launch (your decision, not code):**
- Uzbekistan's personal-data law requires data about Uzbek citizens to be stored on servers inside
  the country. That already applies to the `users` collection. This feature adds message content, so
  it's worth confirming where your Mongo cluster lives.

---

## 6. Rollout order

1. Shared schemas, then the API model, ingest endpoint and classification, then a manual `curl` of a sample
   batch.
2. Bot middleware and recorder. Deploy, send yourself `/start`, text, a contact, a photo, then
   block/unblock, and confirm the rows.
3. The admin list and facets endpoints.
4. The web page, nav entry and `/all-usermessages` redirect.

The bot can ship before the page. Data starts accumulating immediately, which is the point: replies
to the next broadcast are captured even if the page lands a week later.

---

## Later (designed for, not built)
- **Reply from the page:** the API already holds the bot token (`sendTelegramMessage`). Add a
  `direction: 'in' | 'out'` field and log admin replies as `out` rows in the same timeline.
- **"Handled" marker** per person, so two organisers don't answer the same person.
- **People view:** one row per person with their last message and an unread count (an aggregation
  over the same collection).
- **Media preview:** an admin-only proxy that resolves `fileId` through `getFile`. `fileId` is
  stored now so this needs no backfill.
- **Dashboard card:** "N new messages in 24 h".
- **Mini App tap analytics:** a different feature (a client event pipeline), with its own spec.
- If the collection passes about 1M rows, move `q` from `$regex` to Atlas Search.
