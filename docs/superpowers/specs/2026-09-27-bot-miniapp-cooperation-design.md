# Bot / Mini App / Web App cooperation — design

## Context

Today, the Telegram side of BookQuest is BotFather configuration only: a menu
button that opens the Mini App webview. There is no bot server anywhere in
this repo — no `/start` handler, no commands, no messages the bot sends on
its own. `apps/api`'s only Telegram-shaped code is `utils/telegram.ts`, which
verifies the signed `initData` string the Mini App hands over on boot.

A previous, fully separate implementation of BookQuest (`~/Desktop/Book Quest
/backend-bot`, Telegraf + Supabase, 30 commits) ran registration entirely as
a bot conversation, with an admin keyboard for broadcasting and other admin
actions. **It is the same bot account** as the one this repo uses
(`@bookquest_bot` — the production bot tokens in both repos' `.env` files
share the same numeric id). That old code is not reused directly, but its
account-level state (command menu, whatever keyboard was last shown to each
user) is live on the same bot BookQuest3 now owns, and needs to be retired.

This design covers bringing a bot server into BookQuest3, cleanly, and
extending it and the Mini App per the product direction below. It does not
touch the quiz (still Phase 6, unspecified per `BACKEND-PLAN.md` /
`FRONTEND-PLAN.md`).

**Product direction driving this** (paraphrased from the brainstorm):
the bot is the entry point for new users — `/start` records their Telegram
identity and opens the Mini App, which becomes the home for everything
(registration, results, notifications). The bot's own footprint shrinks to
almost nothing: no keyboard beyond an admin-only broadcast entry point.
Notifications the bot sends should also appear inside the Mini App. The
standalone web app should become fully usable (not read-only) and
installable outside Telegram.

## Decisions made during brainstorming

- **Legacy Supabase migration** (importing last year's participants from the
  old bot's database) is explicitly **out of scope** here — a separate task.
- **Standalone web app**: full parity, not a read-only mirror — gets a real,
  non-Telegram login (Telegram Login Widget), so people can register and
  take the quiz from an installed web app too.
- **Notifications**: cover both admin broadcasts *and* individual
  system-generated messages (certificate ready, results published), unified
  under one model.
- **Broadcast audience**: everyone who has ever started the bot, registered
  or not — matches how the old bot's broadcast worked.
- **Bot/API integration — Approach A**: the bot is a thin Telegraf process
  with **no direct database connection**. Every write goes through the
  existing Express API over HTTP, the same source-of-truth principle
  `packages/shared` already established for validation rules. The bot is a
  Telegram transport layer, nothing more.

## Phase 1 — Bot wiring, clean slate, `/start` → open the Mini App

**Goal:** a fresh user messages the bot, sees no trace of the old
keyboard-driven flow, taps Start, gets one welcome message with one button,
and that button opens the Mini App.

**New workspace — `apps/bot`.** Telegraf, `tsx watch` for dev / `tsc` build
for prod, matching `apps/api`'s conventions where they apply
(`*.services.ts` for anything beyond wiring). Long polling in development —
no webhook, no tunnel needed for the bot process itself (only the Mini App
and API need the ngrok tunnels already set up for local testing). Production
transport (webhook vs. polling) is a deploy-time decision, not solved here.

**New internal API surface**, so the bot can write without pretending to be
a browser (it can't produce signed `initData`):
- Env: `BOT_SERVICE_TOKEN`, a shared secret (generate the same way as
  `JWT_SECRET` — `openssl rand -hex 32`).
- `requireBotService` middleware: checks a header (e.g.
  `X-Bot-Service-Token`) against it, the same shape as the existing
  `requireUser` / `requireAdmin` but for a service caller, not a person.
- `POST /api/v1/bot/users` — upserts a bare `User` from
  `{ telegramUserId, firstName, lastName, username, languageCode }`. This is
  what "records their Telegram account/data" on `/start`, independent of
  whether they ever open the Mini App — the same reason `UserModel` already
  upserts on `/api/v1/auth/telegram`, just reachable from the bot too, so a
  future broadcast can reach someone who bounced after `/start`.

**`/start` handler**: calls the endpoint above, then replies with a welcome
message and a single inline `web_app` button ("Open BookQuest") pointing at
the Mini App URL. Telegram cannot auto-open a Mini App without a tap — this
button *is* "triggering the Mini App to open," as close as the platform
allows. Text is generic in this phase (no "welcome back, #042" — that needs
a participant lookup, deferred; not required for the phase-1 goal).

**Fallback handler**: any other incoming text gets one reply pointing back
at the same button — this, plus the point below, is what replaces the old
keyboard, rather than porting its commands.

**Clean slate on the live bot account:**
- `setMyCommands([])` — clears the old `/` command menu Telegram shows.
- The old bot's last-shown custom keyboard can't be retroactively erased for
  someone already staring at it — Telegram has no "clear this user's
  keyboard" call. Every new message the bot sends (starting with the new
  `/start` reply) sets `remove_keyboard: true`, which clears it the moment
  that person interacts again. No proactive message to old chat ids in this
  phase — that's the migration question, explicitly deferred.

**Mini App boot polish** (small, and this is the moment "seeing the Mini
App" actually happens, so it belongs here): `WebApp.ready()`,
`expand()` / `requestFullscreen()` where available, and
`enableClosingConfirmation()`. Worth being explicit: Telegram has no API to
block the swipe-down/back-gesture close — that's a platform restriction, not
something code works around. A confirmation prompt before closing is the
real ceiling, not literal non-dismissibility.

## Phase 2 — Broadcast & notifications

**Goal:** admin can broadcast to every bot user from the Mini App's admin
area; every participant sees a Notifications feed inside the Mini App that
mirrors what the bot has sent them.

**One unified `Notification` model**, not two: every broadcast fans out
into one document per recipient, and system events (certificate ready,
results published) create the same shape directly.
```
{ user, kind: 'broadcast' | 'system', title, body, readAt, createdAt }
```
A lightweight `Broadcast` record (`{ message, createdBy, createdAt }`) exists
only so admin has a sent-history list — it is not what participants read
from.

**No new bot-side conversation.** Per the product direction ("these features
should now live inside the Mini App"), broadcasting is a form in a new
Admin → Broadcast screen in the existing admin panel — not a chat exchange
with the bot. The bot's only broadcast-related surface is a menu button,
shown only to admin Telegram ids, that deep-links into that admin screen.

**Delivery bypasses `apps/bot` entirely.** The Express API already holds
`TELEGRAM_BOT_TOKEN`; creating a `Notification` triggers the API calling
Telegram's `sendMessage` HTTP endpoint directly. `apps/bot` handles inbound
updates only (§ Phase 1) — this keeps it thin, matching Approach A.

**New API surface:**
- `POST /api/v1/admin/broadcasts` — admin-authenticated (existing session,
  no `BOT_SERVICE_TOKEN` involved — this is a person, not the bot), creates
  the `Broadcast` record and fans out `Notification`s to every `User`.
- `GET /api/v1/me/notifications`, `POST /api/v1/me/notifications/:id/read`.

**New frontend:** `features/notifications` in `apps/web`, an admin broadcast
form under the existing admin area.

**Worth flagging plainly:** fanning out to "everyone who's ever used the
bot" can be hundreds of individual Telegram sends per broadcast. Sequential
sends with basic pacing, not a burst — Telegram has bot-wide rate limits.
Not a queueing system; a scale this project doesn't have yet.

## Phase 3 — Standalone web parity & installability

**Goal:** the web app works fully outside Telegram — real login, not a
read-only mirror — and can be installed to a phone's home screen.

**Second verification path, alongside `verifyInitData`:** a
`verifyLoginWidget` function in `utils/telegram.ts` — same shape (parse,
data-check string, HMAC, constant-time compare, freshness check), different
secret derivation (Login Widget: `SHA256(bot_token)`, not
`HMAC("WebAppData", bot_token)` — the two Telegram login mechanisms are not
interchangeable). New route: `POST /api/v1/auth/telegram-widget`.

**Refactor, not duplication:** both `/auth/telegram` and
`/auth/telegram-widget` converge on the same "upsert user, issue session"
tail currently inlined in `authenticateWithTelegram`. Extract that tail into
one shared function both entry points call, so the two verification paths
can never drift on what happens after a successful check.

**Frontend:** a login screen shown only when the app detects it is *not*
running inside Telegram's webview (embeds Telegram's Login Widget script).
Everything past login — registration, profile, results, notifications —
is the same code already built; it isn't Telegram-webview-specific today
except for how the session is obtained.

**PWA installability:** a web app manifest and a minimal service worker in
`apps/web` — just enough for "Add to Home Screen." Not offline-first
caching; nobody asked for that, and it's real scope this design deliberately
leaves out.

## Non-goals (all phases)

- Migrating last year's Supabase data into MongoDB.
- The quiz itself — untouched, still Phase 6.
- Any literal way to make the Mini App unclosable — not a real platform
  capability.
- Offline-first PWA behavior.
- A queueing/worker system for notification fan-out — sequential sends are
  enough at this project's scale.

## Verification

This repo has no test suite anywhere — `pnpm typecheck` is the stated gate
(see root `README.md`). Each phase is verified the same way: `pnpm
typecheck` across the affected workspaces, plus a manual run-through (the
same tunnel-based setup already used to view the Mini App inside Telegram
Desktop) — not a new testing framework.
