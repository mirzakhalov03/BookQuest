# BookQuest — Backend Implementation Plan

> Backend only. Architecture, schema and the full API contract are in `BACKEND-SPEC.md`; the
> frontend's matching roadmap is in `FRONTEND-PLAN.md`. Phases are ordered by dependency.

**How to read this.** Each phase states what the backend ships and what the frontend can start
consuming the moment it lands. Because the contract is agreed up front, the frontend builds against
it in parallel — the backend's job is to make the contract true, in the order that unblocks the most
frontend work.

---

## Status — Phases 0–5 shipped

Built and exercised end to end against a live MongoDB: sign-in, registration, self-lookup, the
public participant view, the archive, results, certificates, and the whole admin surface. Phase 6
(the quiz) remains deliberately unplanned.

Verified in that run, rather than assumed:

- A participant token gets `403` from `/admin/*`; no session gets `401`. The token itself carries
  `{ sub, iat, exp }` and no role.
- A tampered signature, and a valid `initData` older than the freshness window, both get a flat
  `401` with no hint about which check failed.
- Two concurrent registrations from one user: one `201`, one `409` — decided by the unique index,
  not by the read that precedes it.
- Two users registering at the same moment received `3005` and `3006`. Number `3002` is missing,
  burned by the failed half of the concurrency test. That gap is the design working: a number is
  consumed by the allocation, not by the insert.
- Two participants registered with the *same phone number*, which the old unique index would have
  refused. Contact is reachability; identity is the Telegram user.
- Results ranked once on first read after `resultsAt` — `20/480s` ahead of `20/610s`, the tie broken
  by duration — and identical on the next read.
- `initData`, bearer tokens and contact values: zero occurrences in the log output.

**Decisions taken during execution** (each was a `TBD`; all are recorded in the specs):

| # | Decision | Why this one |
|---|---|---|
| TBD-1 | Read-only web | Registration is a Telegram-only action, which is how the contest is actually run. The widget stays available later with no contract change. |
| TBD-2 | Registration closes at `readingDeadline` | The prototype's own copy promises it. |
| TBD-3 | Certificate as JSON, rendered client-side | A headless browser in the API for a once-a-year artifact is not proportionate. |
| TBD-4 | `book.resources` public | The rest of the quest is public; gating one field would be the odd rule out. |
| TBD-5 | **Cap kept at 1000** (`3000–3999`) | Zero code change, and it keeps the four-digit number the design is built around. **The prototype's mock `readers: 1204` is now the thing that is wrong** — see below. |
| TBD-6 | Cover image as a URL field | No storage decision needed yet. |
| TBD-7 | No admin-assisted registration | It would mean a participant with no user, which the schema forbids. |
| — | Migration | Moot: the development database held **zero** participants, so nothing needed backfilling. |

**TBD-5 is the one to overrule if it is wrong.** It was the cheapest option, not necessarily the
right one — a 1001st registration gets `409 "This year's quest is full."` Widening to five digits is
two constants and a display width *today*, and a renumbering of real people once numbers are issued.

**Two things were deliberately not done:**

1. **ESLint.** typescript-eslint hard-refuses to load against TypeScript 7
   ([#10940](https://github.com/typescript-eslint/typescript-eslint/issues/10940)) — it throws, with
   no override. Rather than leave `pnpm lint` resolving to nothing, the script and its turbo task
   were removed. `pnpm typecheck` is the gate until that lands.
2. **No commit.** `git init` ran; staging and the first commit are yours to make.

---

## Phase 0 — Setup audit and gaps

**Deliverable:** the existing service verified, gaps named, nothing rebuilt.

Working and untouched: Express 5 app assembly, `routes → controllers → services → models` layering,
boot-time zod env validation, the single `ApiError` exit, `resolvePhase()`, the atomic
`nextSequence()` allocator, the shared validation package, pino logging, graceful shutdown, and the
idempotent seed script.

**Gaps to close in this phase:**

1. **`git init`.** The project is not under version control.
2. **`forbidden` added to `API_ERROR_CODES`** and `ApiError.forbidden()` added. Small, but the
   frontend imports this type — do it first so both sides compile.
3. **ESLint.** `pnpm lint` delegates to a turbo task no workspace defines. Add it or remove the
   script; a check that silently passes is worse than none.
4. **Port 4000 is occupied** on the current dev machine by an unrelated node process (PID 6676).
   Either free it or set `PORT=4010`.
5. **`.env` loading is dev-only.** `--env-file-if-exists=../../.env` is right for local work and
   wrong for a host, which injects real environment variables. `config/env.ts` already reads
   `process.env`, so nothing changes in code — but the deploy must not rely on a `.env` file.

**Deployment audit — current state: nothing is configured.** No Dockerfile, no CI, no host config,
no process manager. What exists is `pnpm dev` and a `start` script.

| Concern | Recommendation |
|---|---|
| Host | A long-running Node host — Railway, Render, Fly, or a VPS. **Not** serverless: Mongoose expects a pooled connection held across requests, and cold starts would reconnect constantly. |
| Database | MongoDB Atlas free/shared tier. Locally there is already a `mongod` at `127.0.0.1:27017`. Production needs a **least-privilege user scoped to the `bookquest` database**, not the cluster admin. |
| Build | `pnpm build --filter @bookquest/api...` — the `...` matters, it builds `@bookquest/shared` first. Turbo's `dependsOn: ["^build"]` already encodes the order. |
| Run | `node dist/server.js` with environment variables injected by the host. |
| Health | `/health` exists and is ready to be the host's health check. |
| Dev/prod split | Separate `MONGODB_URI`, `JWT_SECRET`, `CORS_ORIGIN`, and `TELEGRAM_BOT_TOKEN` (a separate test bot for staging). |
| HTTPS | Required — Telegram will not load a Mini App over `http://`. Terminate at the host. |
| CI | GitHub Actions: `pnpm install --frozen-lockfile`, `pnpm typecheck`, `pnpm build`. Enough for a two-person project. |
| Backups | Atlas snapshots. A participant number is permanent and printed on a certificate — losing the collection is unrecoverable. |

**Frontend needs from this phase:** the `forbidden` error code in the shared package (hard block on
their Phase 1 compile).

**Open questions:** none.

---

## Phase 1 — Auth, identity, and closing the open endpoints

The security phase. It both adds identity and fixes the two open endpoints, because adding auth
without applying it would leave the holes in place.

**Backend delivers:**

- `models/user.model.ts` — `telegramUserId` (unique, **stored as a string** — Telegram ids exceed
  2^53 and must never round-trip through a JS number), profile fields, `role`, `lastSeenAt`.
- `utils/telegram.ts` — `initData` verification: parse, build the sorted data-check string,
  `secret = HMAC(key: "WebAppData", data: BOT_TOKEN)`, compare with **`crypto.timingSafeEqual`**,
  reject `auth_date` older than `AUTH_INIT_DATA_MAX_AGE_SECONDS`.
- `utils/token.ts` — sign and verify HS256 JWTs carrying `{ sub, iat, exp }` and **nothing else**.
  No role in the token: a role baked into a token stays valid after it is revoked.
- `services/auth.services.ts` — verify, upsert the user, resolve `role` from `ADMIN_TELEGRAM_IDS`,
  issue the token.
- `middlewares/auth.middleware.ts` — `requireUser`, `requireAdmin`, `optionalUser`. Each loads the
  user **from the database**, never from token claims.
- `middlewares/rate-limit.middleware.ts` — registration per user per hour, auth per IP per minute, a
  global ceiling.
- `POST /auth/telegram`, `GET /auth/me`.
- `config/env.ts` 🚧 — `TELEGRAM_BOT_TOKEN` promoted from optional to **required**; `JWT_SECRET`
  (min 32 chars), `ADMIN_TELEGRAM_IDS`, `AUTH_INIT_DATA_MAX_AGE_SECONDS` added. The process refuses
  to boot without them, which is the intended behaviour — a service running without a bot token is a
  service that cannot authenticate anyone.

**Fixes shipping in this phase (from the audit):**

| # | Fix |
|---|---|
| B1 / S1 / S2 | `GET /participants/:number` requires a session and returns `ParticipantPublic` — **no `contact`**. This closes the enumeration hole: 1000 sequential requests currently harvest every participant's name and phone number. |
| B4 | `POST /participants` requires a session, and gains rate limiting. |
| B7 | `forbidden` code and `ApiError.forbidden()`. |
| B5 / S4 | `E11000` mapped to `409 conflict` in the error middleware. The `findOne`-then-`create` check is a race; the unique index is what actually holds, so its error must surface as a friendly conflict rather than escaping as a 500. |
| S8 | pino redaction for `initData`, `authorization`, and `contact.value`. |
| B3 | `participants.user` reference added; `{ quest, user }` unique index; `telegramUserId` string removed from the participant document. |

**Frontend gets:** the whole auth flow — `POST /auth/telegram`, `GET /auth/me`, and authenticated
registration. This unblocks their Phase 1 entirely.

**Open questions:**
- **TBD-1** — web fallback. Recommending **read-only web** for launch: the API is unchanged, and the
  Telegram Login Widget (~30 lines, a different secret derivation and a flat payload) can be added
  later without touching the contract.
- **Migration.** Any participants already registered without a `user` reference cannot satisfy the
  new required field. With a development-only dataset this is a wipe. If real registrations exist,
  the field must land nullable first, then backfill, then tighten. **Confirm before deploying.**

---

## Phase 2 — Quest content model

Short phase; unblocks the frontend's largest one.

**Backend delivers:**

- `models/quest.model.ts` 🚧 — `book.description`, `book.resources[]` (`{ label, url, kind }`,
  `_id: false`), `prizes { first, second, third }` as free-text strings, `quizQuestionCount`,
  `quizDurationMinutes`.
- `toQuestDto` 🚧 and the shared `questSchema` 🚧 extended to match.
- `{ year: -1 }` index for the archive.
- Partial unique index on `{ isCurrent: 1 }` where `isCurrent: true`, so two current quests become
  impossible at the storage layer rather than by convention.
- `scripts/seed.ts` 🚧 — seeds the new fields with the prototype's content.

**Frontend gets:** the real `Quest` shape, so Home, `BookPage` and the prize display can be built
against actual data instead of a placeholder.

**Open questions:**
- **TBD-4** — are `book.resources` public, or registered-only? If gated, the field is stripped from
  the DTO for anonymous callers rather than the endpoint being locked — the rest of the quest stays
  public.
- Prizes as free text vs. structured `{ title, description, imageUrl }`. Free text is recommended:
  two admins typing "AirPods Pro" need no schema, and a structure invented now will be wrong.

---

## Phase 3 — Registration rules and self-lookup

**Backend delivers:**

- `GET /participants/me` — the caller's registration for the current quest, `404` when authenticated
  but not registered. This is a normal state, not a failure; the frontend routes to registration.
- Registration phase gate (**TBD-2**) — reject with `409 conflict` once registration closes.
- Registration hardened end to end:
  1. `requireUser` → 2. rate limit → 3. shared-schema validation *and normalisation in one
  `.transform()* → 4. load current quest → 5. phase gate → 6. `create()` with `E11000` → 409 →
  7. `$inc participantCount` → 8. `201`.
- `{ quest: 1, fullName: 1 }` index for the admin search landing in Phase 4.
- `{ quest, 'contact.value' }` uniqueness **relaxed to non-unique**. Once identity is the Telegram
  user, contact is only a reachability field, and the unique index wrongly blocks two family members
  sharing a phone number. `{ quest, user }` is the correct constraint and lands in Phase 1.

**Participant ID — no change.** The implemented `findByIdAndUpdate` + `$inc` allocator already
satisfies every requirement: single atomic document operation so concurrent callers get distinct
values; never reads the participant collection so deletions cannot cause a collision; monotonic, so
a failed registration skips a number permanently — a gap is harmless, a reissued number is not; and
keyed per quest so each edition restarts at 3000. It is documented in `BACKEND-SPEC.md § 5` rather
than reimplemented.

**Frontend gets:** `/participants/me` as the source of truth for the participant number, replacing
the persisted `localStorage` copy.

**Open questions:**
- **TBD-2** — registration closes at `readingDeadline`, at `quizOpensAt`, or never? The prototype's
  own copy says *"Registration closes when the reading period ends."*
- **TBD-5 — decide before this phase ships.** `3000–3999` is exactly 1000 slots; the prototype's
  mock data says 1204 readers. Either accept a 1000-person cap or widen to 5 digits. Changing the
  range after numbers are issued means renumbering people — and the number is permanent, printed on
  a certificate. This is the one open question with a real cost of delay.

---

## Phase 4 — Admin

**Backend delivers:**

- `routes/admin/` mounted behind `requireAdmin` **at the router**, not per route, so a new admin
  route cannot be added unprotected by accident.
- `GET /admin/participants` — paginated, searchable by name or number.
- `PATCH /admin/quests/:id` — book, dates, prizes, quiz metadata. `edition`, `year` and
  `participantCount` are not accepted on any update path: edition and year are identity, and the
  count is owned by the registration flow.
- Date-ordering validation:
  `opensAt < readingDeadline ≤ quizOpensAt < quizClosesAt ≤ resultsAt`, rejected as
  `400 validation_failed` with per-field messages. The frontend mirrors this for immediate feedback;
  the server decides.
- `POST /admin/quests` and `POST /admin/quests/:id/make-current` — the latter in a transaction, so
  there is never zero or two current quests.
- `GET /admin/stats` — dashboard numbers.
- Admin mutations logged through pino with the acting `telegramUserId`, the route, and the changed
  keys. **Not a full audit collection** — two admins at low volume do not justify one, and it can be
  added cleanly later if it is ever actually wanted.

**Frontend gets:** the whole admin area, and the guarantee that its role check is cosmetic — a
tampered client flag produces a shell full of `403 forbidden` and changes nothing.

**Open questions:**
- **TBD-6** — cover image: a URL field, or an upload endpoint? A URL needs no storage decision and
  is the right first answer; uploads bring object storage, size limits and content-type validation.
- **TBD-7** — admin-assisted registration for someone without Telegram? Realistic for a local
  contest, but it means a participant with no `user`, which the Phase 1 schema forbids. If wanted,
  design it now rather than loosening the constraint later.

---

## Phase 5 — Results and certificates

Minimal scope. Assumes quiz submissions exist; the quiz itself is Phase 6.

**Backend delivers:**

- `models/result.model.ts` — `quest`, `participant`, `score`, `total`, `durationMs`, `rank`,
  `certificateCode`, `submittedAt`. `total` is stored per result so an old result stays readable if
  the question count changes.
- Index `{ quest: 1, score: -1, durationMs: 1 }` — the leaderboard sort served entirely from the
  index. `{ quest, participant }` unique. `{ certificateCode }` unique sparse.
- Ranking computed **once** at publication and frozen into `rank`, not recomputed per request. A
  rank that shifts between two page loads is a bug people notice immediately.
- `GET /quests/current/results` — `404` before `resultsAt`. Results that do not exist yet are not
  found, not forbidden.
- `GET /participants/me/certificate` — `CertificateData` for anyone who completed.
- `GET /quests` and `GET /quests/:edition` — the archive, `:edition` keyed by the number people
  actually say out loud rather than an ObjectId.
- **No `certificates` collection.** A certificate is a view of participant + quest + result; storing
  it separately creates a second copy of a name that can drift out of sync. Only the verification
  code is persisted, on the result.

**Frontend gets:** `/results`, `/me`, the certificate, and the archive.

**Open questions:**
- **TBD-3** — certificate as client-rendered JSON or a server-generated PDF? The JSON endpoint is
  required either way, so this can be decided after Phase 5 starts. Server-side rendering means a
  headless-browser dependency in the API — a real cost for a once-a-year artifact.
- Is the full leaderboard public, or top-N public with individual ranks private? A privacy choice,
  not a technical one.
- Tie-breaking beyond `durationMs`: if two people match on both score and time, rank by
  `submittedAt`. Needs confirming, but it is a one-line sort key.

---

## Phase 6 — Quiz

**Not planned here.** Question delivery, answer submission, scoring, timing, anti-cheat and
resumption need their own plan and their own contract.

What this plan provides for it: `quizOpensAt` / `quizClosesAt` / `quizQuestionCount` /
`quizDurationMinutes` on the quest, the `quiz` phase already derived by `resolvePhase()`, and the
`Result` model shaped to receive submissions. **No quiz endpoints are defined**, and neither side
should build against an imagined one.

---

## Consolidated open questions

All seven were answered to ship; the table above records what was chosen and why. Only two are worth
revisiting:

| # | Decision | Revisit when |
|---|---|---|
| TBD-5 | 1000-participant cap kept | **Before the first real registration.** After that, changing it means renumbering people, and the number is printed on a certificate. |
| TBD-1 | Web is read-only | A web audience actually exists. The Login Widget is ~30 lines and needs no contract change. |

Still open, and genuinely outside this plan:

| Question | Owner |
|---|---|
| Is the full leaderboard public, or top-N public with individual ranks private? | Product — a privacy call, not a technical one |
| The quiz: delivery, scoring, timing, anti-cheat, resumption | Its own plan and its own contract |
