# Audit Fixes — Design

> Source: *BookQuest Code Audit* (5 Oct 2026, `feat/admin-redesign @ b50c4c1`). Every finding below
> was re-verified against `main @ 439324d` on 9 Nov 2026 before this spec was written.

**Goal:** close the audit's blockers (A1–A3) and every bug / loophole (B1–B10) before the quiz is
built, so the quiz lands on a sound admin model, a race-free results pipeline and one `/quiz` route.

**Out of scope:** the architecture items (Q1–Q6) and every performance item (P1–P10). They are not
bugs, and most are better done alongside the quiz or the first deploy. Q1 (cover URLs) must land
before the first real deploy.

---

## Summary

| ID | Fix | Area | Size |
|---|---|---|---|
| A1 | Admin phone numbers sign in with one shared admin password | API | S |
| A2 | "Is admin" is worked out per request from `.env`, never trusted from storage | API | S |
| A3 | Delete the unused `make-current` endpoint | API | S |
| B1 | Ranking is deterministic and certificate codes are written once | API | S |
| B2 | Rate limits keyed by user where possible; Mini App sign-in limit raised | API | S |
| B3 | Phone numbers stored in one canonical form `+<digits>` | Shared, API | S + migration |
| B4 | Bot `/start` always replies, even when the API is down | Bot | S |
| B5 | Login-code requests capped per IP and answered with one neutral message | API | S |
| B6 | Podium public; full leaderboard for signed-in users only | API, Web | S |
| B7 | Client mistakes return 4xx, not 500 | API | S |
| B8 | Screens refetch the moment a countdown reaches zero | Web | S |
| B9 | One `/quiz` route — the public countdown | Web | S |
| B10 | Inside Telegram, Telegram decides who is signed in | Web | S |

A single one-off script, `scripts/migrate-audit-fixes.ts`, carries the two data changes (A1/A2 role
reset, B3 phone normalisation).

---

## A1 — Admin phone sign-in with a shared password

**Problem.** `POST /auth/register` grants `admin` to whoever first registers a number listed in
`ADMIN_PHONE_NUMBERS`. Nobody proves they own the number.

**Decision (product owner).** A listed phone number signs in only with the organisers' shared admin
password. No other check.

**Design.**

- New env value `ADMIN_PASSWORD`. Set locally to the agreed password; never committed. When
  `ADMIN_PHONE_NUMBERS` is non-empty and `ADMIN_PASSWORD` is missing, the API refuses to start in
  production and warns in development.
- `authenticateWithPhone` and `registerWithPhone` both check the phone first. If it is on the admin
  list, they hand off to one function, `authenticateAdminPhone(phone, password, firstName?)`:
  - Compare the password with `ADMIN_PASSWORD` in constant time (SHA-256 both sides, then
    `timingSafeEqual`, so lengths never leak).
  - Wrong password: the usual `401 "Incorrect phone number or password."`, the same message as any
    failed login, so the admin list cannot be probed.
  - Right password: find the user by phone, or create one (name from the register form, or
    "Organiser" on the login tab), set `role: 'admin'`, issue the session.
- So either tab works for an organiser: number + shared password gets them in.
- `createUserWithPhone` no longer sets a role. A normal registration is always a participant.
- No web change. The phone form already asks for a password on both tabs.

**Rate limit.** `/login` and `/register` stay on the strict 20/min per-IP limit (see B2), which is
what stands between the shared password and guessing.

## A2 — "Is admin" decided per request

**Problem.** `requireAdmin` trusts the stored `role`, which only some sign-in paths rewrite. A
removed admin keeps access.

**Design.** One function, `isAdmin(user)`, in `services/user.services.ts`:

```ts
isAdmin(user) =
  adminTelegramIds.has(user.telegramUserId)                 // Telegram admins: the list alone
  || (adminPhoneNumbers.has(user.phoneNumber)               // phone admins: on the list AND
      && user.role === 'admin')                             //   have proven the shared password
```

- `requireAdmin` and `toSessionUser` both call it. Nothing else reads `role` for access.
- `upsertUserFromTelegramProfile` stops writing `role`. The stored `role` now means only "this
  phone account has signed in with the admin password".
- Removing an ID or number from `.env` revokes access on the next request. Nobody currently listed
  loses access.
- **Migration:** reset every user's stored `role` to `participant`. Telegram admins are unaffected
  (they come from the list). Phone admins sign in once with the shared password. This also wipes
  any account that claimed admin through the old A1 hole.

## A3 — Delete `make-current`

**Problem.** `POST /admin/quests/:id/make-current` swaps the current edition without the results
guard or ranking the outgoing edition. Nothing calls it.

**Design.** Remove the route, the controller and `makeQuestCurrent` from the quest service, and its
entry in the API docs. Creating an edition with `makeCurrent: true` stays the one guarded way to
swap editions.

## B1 — Race-free ranking

**Problem.** Ranking runs lazily on the first read after `resultsAt`. Simultaneous first reads each
rank and each generate fresh certificate codes, and the last writer wins, so a code someone already
saw can change.

**Design.** Make concurrent ranking harmless instead of locking it:

1. **Deterministic order.** Sort by `score ↓, durationMs ↑, submittedAt ↑, _id ↑`. The `_id`
   tie-break means every concurrent ranker computes identical ranks, so overlapping writes agree.
2. **Codes written once.** Each row's update is a pipeline:
   `certificateCode: { $ifNull: ['$certificateCode', <new code>] }`. The database keeps whichever
   code landed first; a later ranker can't overwrite it.
3. **One ranking per process.** An in-flight `Map<questId, Promise>` makes concurrent callers in the
   same process await the same run, so the results-day burst does the work once.

*Why not the audit's `rankedAt` claim:* a claim forces losing requests to wait or show
"publishing". With (1) and (2), any number of rankers are correct, and (3) removes the waste. No new
schema field.

## B2 — Fair rate limits

**Problem.** Every limit is per IP. Carrier NAT and school networks put many people behind one
address, and a broadcast sends them all into the Mini App at once.

**Design.**

- **Global limiter:** keyed by the session's user id when a valid bearer token is present (the token
  is verified, so a forged one can't mint fresh buckets), by IP otherwise.
- **`/auth/telegram`** (Mini App initData exchange) gets its own limiter, 120/min per IP. Every call
  needs a valid Telegram signature, so the looser cap costs nothing.
- **`/login`, `/register`, `/telegram-widget`, `/telegram/link`, `/telegram-code/*`** keep the strict
  20/min per IP.
- **`trust proxy`** reads a new `TRUST_PROXY_HOPS` env value (default `1` in production), to be
  confirmed on the real host.

## B3 — One phone format

**Problem.** `+998901234567` and `998901234567` are different accounts. Login fails if typed the
other way, and the admin list matches only one form.

**Design.**

- The shared phone schema in `schemas/auth.ts` gains a transform to `+<digits>`. Register and login
  both go through it.
- `adminPhoneNumbers` is normalised the same way when `.env` is parsed.
- Login-code lookup drops its both-forms workaround and queries the one form.
- **Migration:** rewrite every `User.phoneNumber` to `+<digits>`. Collisions (two accounts that
  differ only by the `+`) are reported and left untouched for a manual merge.

## B4 — Bot `/start` always replies

**Problem.** `upsertUser` doesn't catch a thrown `fetch` and has no timeout, so an unreachable API
stops the "Open BookQuest" button from being sent.

**Design.** `upsertUser` wraps the call in `try/catch` with `AbortSignal.timeout(5000)`, logs, and
returns. Recording the profile is optional; the button is not.

## B5 — Login codes can't be used to spam

**Problem.** Reg numbers are sequential, so anyone can make the bot DM every participant. The
distinct 404 / 409 / 422 replies also reveal who has an account and whether it's linked to Telegram.

**Design.**

- A new per-IP limiter on `/telegram-code/request`: 10/hour, on top of the per-minute auth limit.
- "No match", "matches several people" and "no Telegram linked" collapse into one reply: `404` with
  *"We couldn't send a code to that. Try your reg number or @username, or log in with your
  password."* The web form shows it as a field error, as it does today.

## B6 — Leaderboard privacy

**Problem.** `GET /participants/:number` needs a session because numbers can be enumerated, but
`GET /quests/current/results` publishes every name and number to anyone.

**Decision (product owner).** Podium public; full leaderboard for signed-in users.

**Design.**

- `/quests/current/results` runs `optionalUser`. Signed out, `leaderboard` holds only the podium
  rows. Signed in, it holds everyone.
- `QuestResults` gains `finishedCount: number` and `isFullBoard: boolean`, so the client can show
  what it's missing. (`total` was taken: each entry already uses it for the question count.)
- `Cache-Control: private` on this response, since it now differs per viewer.
- **Web:** a signed-out Results screen shows the podium, then a card: *"{finishedCount} readers finished.
  Sign in to see the full leaderboard and your rank."* with a sign-in button (to `/me`, the existing
  join/sign-in place). Signed in: unchanged.
- Past editions only ever expose the winner, so the archive needs no change.

## B7 — Bad requests are 4xx

**Problem.** Malformed JSON, oversized bodies and Mongoose `ValidationError` / `CastError` fall
through to the 500 branch.

**Design.** Before the 500 branch of `errorHandler`:

- An error with a 4xx `status` and `expose: true` (what body-parser throws) → that status, code
  `validation_failed` (`400`) or `payload_too_large` (`413`), and a plain message.
- `mongoose.Error.ValidationError` / `CastError` → `400 validation_failed`.

Only true faults are logged at `error`.

## B8 — Live phase changes

**Problem.** The phase is computed when the quest is fetched. When a countdown reaches zero nothing
refetches, so Home keeps the old action and Results shows `00:00:00` until the user navigates.

**Design.**

- `useCountdown(target, onComplete?)` fires `onComplete` once, when the remaining time first reaches
  zero (not on mount if it's already past).
- A small hook, `useRefreshOnPhaseEnd()`, returns the callback: refetch the current quest (and, on
  Results, the results query) with the browser cache bypassed (`cache: 'no-cache'`), because the API
  sends `max-age=30` and could hand back the old phase.
- Home, Results and Quiz pass it to their `Countdown`.

## B9 — One `/quiz` route

**Problem.** `/quiz` is declared twice. React Router ranks the session-guarded index route higher,
so the public countdown never renders and signed-out visitors hit a sign-in wall.

**Design.** Delete the guarded "coming next" block. The public `QuizPage` countdown is the only
`/quiz` route until the quiz exists. Fix the stale comments in `router.tsx` and `QuestAction.tsx`.

## B10 — Telegram is the authority inside the Mini App

**Problem.** At boot a stored token beats `initData`, so a device that holds another account's
session opens the Mini App as that person.

**Design.** In `resolveSession`, when Telegram's `initData` is present and the stored session's
`telegramUserId` differs from `initData.user.id` (including a session with no Telegram id), drop the
stored token and cache and run the initData exchange. Outside Telegram, nothing changes.

---

## Migration — `scripts/migrate-audit-fixes.ts`

Idempotent; safe to run twice. Run with `pnpm --filter @bookquest/api migrate:audit`.

1. `User.updateMany({}, { $set: { role: 'participant' } })` (A1/A2).
2. Normalise every `User.phoneNumber` to `+<digits>`. Report collisions and skip them (B3).
3. Print a summary: roles reset, phones rewritten, collisions found.

## Verification

- `pnpm typecheck` across the monorepo.
- Run against the local API:
  - Admin number + wrong password → 401. + shared password → admin session. Non-admin number →
    normal flow. Registering an admin number never yields admin without the password.
  - Remove a Telegram id from `.env`, restart → that user gets 403 on `/admin/*`.
  - `POST /admin/quests/:id/make-current` → 404.
  - Concurrent `GET /results` (×20) on an unranked quest → one set of certificate codes, stable on
    re-read.
  - Malformed JSON → 400; a body over 100 kb → 413.
  - `/quests/current/results` signed out → podium only, `isFullBoard: false`.
  - `/quiz` signed out → countdown, not a sign-in wall.
- Bot: stop the API, send `/start` → button still arrives.
