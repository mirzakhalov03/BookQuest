# BookQuest — Backend Specification

> Scope: `apps/api` and `packages/shared`. Paired with `FRONTEND-SPEC.md`; the API contract at the
> end of this document is byte-identical in both. Implementation order is in `BACKEND-PLAN.md`.

---

## 1. Audit — what exists today

`apps/api` is a working Express 5 + Mongoose 9 service with three endpoints, a clean layering
convention, and a seed script. It builds, typechecks, connects to MongoDB, and has been exercised
end to end. The structure is right and should be extended, not replaced.

### Toolchain

| | Version | Note |
|---|---|---|
| Node | 22.13 | `--env-file-if-exists=../../.env` — no dotenv dependency |
| Express | 5.2 | Auto-forwards rejected promises to the error handler, so no `asyncHandler` wrapper is needed |
| Mongoose | 9.9 | `InferSchemaType`, `HydratedDocument`, `returnDocument: 'after'` |
| Zod | 4.5 | `.transform((input, ctx) => …)` + `z.NEVER` for a validating-and-normalising parse |
| TypeScript | 7.0 | `baseUrl` removed by TS7 |
| pino / pino-http | 10 / 11 | `pino-pretty` in development |
| helmet, cors | 8 / 2.8 | |

### File inventory

```
apps/api/src/
  server.ts                 connect → listen → SIGINT/SIGTERM graceful shutdown
  app.ts                    helmet, cors, json(100kb), pinoHttp, /health, /api/v1, notFound, error
  config/env.ts             zod-parsed env; throws at boot with a formatted issue list
  config/logger.ts          pino, pretty in dev
  db/connect.ts             one pooled connection for the process lifetime
  routes/index.ts           /quests, /participants
  routes/quest.routes.ts    GET /current
  routes/participant.routes.ts   POST /, GET /:number
  controllers/*.controllers.ts   HTTP only — no logic
  services/*.services.ts         logic + DTO mapping
  models/quest.model.ts          book subdoc, 5 dates, participantCount, isCurrent
  models/participant.model.ts    number, fullName, contact subdoc, quest ref, telegramUserId
  models/counter.model.ts        nextSequence() — atomic $inc allocator
  middlewares/validate.middleware.ts     parse body|query|params, replace with parsed data
  middlewares/error.middleware.ts        notFound + single error exit
  middlewares/telegram-auth.middleware.ts   PLACEHOLDER — calls next(), authenticates nobody
  utils/api-error.ts             ApiError with static badRequest/notFound/conflict/unauthorized
  utils/respond.ts               ok(res, data, status)
  validators/participant.validators.ts   request-shaped wrappers around shared schemas
  scripts/seed.ts                idempotent upsert of the edition-4 quest
```

### Working and worth keeping

- **The layering.** `routes → controllers → services → models`. Routes wire and validate,
  controllers speak HTTP, services hold logic and return DTOs, models are Mongoose only. Held
  consistently across every file. Keep.
- **One error exit.** `ApiError` is the only thing services throw; `errorHandler` is the only place
  a response is shaped. Anything else reaching it is treated as a bug — logged, returned as a
  generic 500 in production. Keep.
- **Boot-time env validation.** `config/env.ts` refuses to start on bad configuration and prints
  which keys are wrong. Nothing else reads `process.env`. Keep.
- **Derived phase.** `resolvePhase()` computes `upcoming | reading | quiz | finished` from the clock
  on every read. No stored status column, therefore no possibility of the database disagreeing with
  reality because a cron job was missed. Keep — and extend the same principle to results visibility.
- **Atomic number allocation.** `nextSequence()` uses `findByIdAndUpdate` + `$inc` + `upsert`,
  which is a single atomic document operation. Two simultaneous registrations cannot collide. Keep.
- **Shared validation.** `packages/shared` holds `parseFullName`, `parseTelegramUsername`,
  `parsePhoneNumber` and the zod schemas. The browser and the API run the *same functions*, so the
  client cannot be ahead of or behind the server. Keep — this is the most valuable thing in the repo.

### Gaps and defects

| # | Finding | Severity |
|---|---|---|
| B1 | **`GET /participants/:number` is unauthenticated and returns `contact.value`.** Numbers are sequential from 3000, so 1000 requests harvest every participant's full name and phone number. | **High** — fix in Phase 1 |
| B2 | `telegram-auth.middleware.ts` is a placeholder that calls `next()`. No identity exists anywhere. | High — Phase 1 |
| B3 | No `User` model, no roles, no admin concept. | High — Phases 1 & 4 |
| B4 | **`POST /participants` is unauthenticated and unthrottled.** Anyone can burn through the 3000–3999 range. | High — Phase 1 |
| B5 | `registerParticipant` does a `findOne` then a `create` — a check-then-act race. The unique index catches it, but the duplicate surfaces as an unhandled `E11000` 500, not a friendly `409`. | Medium |
| B6 | Registration is accepted after `readingDeadline`. No phase gate. | Medium — TBD-2 |
| B7 | `forbidden` is missing from `API_ERROR_CODES`; `ApiError` has no `.forbidden()`. | Low — Phase 1 |
| B8 | No rate limiting anywhere. | Medium |
| B9 | No prizes, description, resources, or quiz metadata on the quest — all listed as admin-editable. | Medium — Phase 3 |
| B10 | No results, certificates, or quest archive. | Phase 5 |
| B11 | No `POST /admin/*` anything; no way to change the book without editing `seed.ts`. | Phase 4 |
| B12 | No graceful handling of "no current quest" beyond a 404 — fine, but the frontend must treat it as an empty state. | Low (documented) |
| B13 | `.env` is loaded from the repo root via `--env-file-if-exists`. Works locally; **not** how a hosted deployment will supply config. | Low — Phase 0 |
| B14 | Not a git repository. No CI, no deployment config of any kind. | Medium — Phase 0 |

### Capacity conflict — needs a product decision

`PARTICIPANT_NUMBER_MIN = 3000`, `MAX = 3999`. Four digits starting with `3` is **exactly 1000
slots**. `prototype/js/data.js` shows `readers: 1204`.

Those two cannot both be true. See **TBD-5**. This is the one open question that could require a
schema change after launch, so it should be settled before Phase 1 ships.

---

## 2. Proposed architecture

Same layering, more modules. Nothing is restructured.

```
apps/api/src/
  server.ts  app.ts
  config/      env.ts  logger.ts
  db/          connect.ts
  routes/
    index.ts            /auth /quests /participants /results /admin
    auth.routes.ts                                    ⬜
    quest.routes.ts     + list, by-edition            🚧
    participant.routes.ts  + /me                      🚧
    result.routes.ts                                  ⬜
    admin/
      index.ts  participant.routes.ts  quest.routes.ts  stats.routes.ts   ⬜
  controllers/   one per route file, HTTP only
  services/
    quest.services.ts        + list, byEdition, update          🚧
    participant.services.ts  + findForUser, phase gate          🚧
    auth.services.ts         verify initData, issue/read token  ⬜
    result.services.ts       ranking, certificate data          ⬜
    admin.services.ts        paginated queries, quest editing   ⬜
  models/
    quest.model.ts       + prizes, description, resources, quiz meta  🚧
    participant.model.ts + user ref; contact index reconsidered       🚧
    counter.model.ts     unchanged
    user.model.ts        telegramUserId, profile, role                ⬜
    result.model.ts      score, durationMs, rank, certificateCode     ⬜
  middlewares/
    validate.middleware.ts     unchanged
    error.middleware.ts        + E11000 → 409 mapping   🚧
    auth.middleware.ts         requireUser / requireAdmin / optionalUser  ⬜
    rate-limit.middleware.ts                            ⬜
  utils/
    api-error.ts  + forbidden(), tooManyRequests()      🚧
    respond.ts    unchanged
    telegram.ts   initData HMAC verification             ⬜
    token.ts      sign / verify session tokens           ⬜
  validators/    one per resource, wrapping shared schemas
  scripts/       seed.ts  + create-quest.ts              🚧
```

**Invariants:**

1. Controllers contain no logic and no database calls. If a controller has an `if`, it belongs in a
   service.
2. Services return DTOs, never Mongoose documents. The `toXDto` functions are the boundary.
3. Models contain schema and indexes. No business methods, no hooks that hide behaviour.
4. Every authorization check happens in middleware or a service — never inferred from the request
   body, a header the client sets, or anything else the client controls.

---

## 3. Database schema

MongoDB + Mongoose, already configured. Five collections at this scope.

### `users` ⬜ new

Telegram identity. Created on first successful `/auth/telegram`.

| Field | Type | Notes |
|---|---|---|
| `telegramUserId` | String, required, **unique** | Telegram's numeric id, stored as a string — it exceeds 2^53 for some accounts and must never round-trip through a JS number |
| `firstName` | String, required | From `initData`, refreshed on each login |
| `lastName` | String, default null | |
| `username` | String, default null | Telegram handle; can change, never used as a key |
| `photoUrl` | String, default null | |
| `languageCode` | String, default null | |
| `role` | String, enum `['participant','admin']`, default `'participant'` | Resolved from the env allowlist on every login |
| `lastSeenAt` | Date | |
| `createdAt` / `updatedAt` | Date | `timestamps: true` |

**Indexes:** `{ telegramUserId: 1 }` unique.

### `quests` ✅ 🚧

| Field | Type | Notes |
|---|---|---|
| `edition` | Number, required, **unique**, **immutable** | Identity. `1, 2, 3, 4 …` |
| `year` | Number, required, **immutable** | |
| `book.title` / `.author` | String, required | |
| `book.pages` | Number, required, min 1 | |
| `book.coverUrl` | String, default null | |
| `book.description` | String, default null | ⬜ admin-editable |
| `book.resources[]` | `{ label, url, kind }`, `_id: false` | ⬜ admin-editable |
| `prizes.first/.second/.third` | String, default null | ⬜ free text — "AirPods Pro", "500,000 so'm" |
| `opensAt` … `resultsAt` | Date, required (×5) | Ordering enforced in the service, not the schema |
| `quizQuestionCount` | Number, default null | ⬜ |
| `quizDurationMinutes` | Number, default null | ⬜ |
| `participantCount` | Number, default 0 | Denormalised so Home never counts a collection |
| `isCurrent` | Boolean, default false | Exactly one true at a time |
| `createdAt` / `updatedAt` | Date | |

**Indexes:** `{ edition: 1 }` unique · `{ isCurrent: 1 }` · `{ year: -1 }` ⬜ for the archive.

**No stored `phase`.** Derived by `resolvePhase()` from the dates on every read.

**`isCurrent` integrity.** Only `POST /admin/quests/:id/make-current` may change it, inside a
transaction that unsets the previous one. A partial unique index
(`{ isCurrent: 1 }`, `partialFilterExpression: { isCurrent: true }`, `unique: true`) makes two
current quests impossible at the storage layer. ⬜

### `participants` ✅ 🚧

| Field | Type | Notes |
|---|---|---|
| `number` | Number, required, 3000–3999, **immutable** | Permanent once assigned |
| `fullName` | String, required, trimmed | Stored normalised — "Sofia Karimova" |
| `contact.method` | String, enum `['telegram','phone']` | Subdocument, `_id: false` |
| `contact.value` | String, required | Stored normalised — `@sofia_k` / `+998 90 123 45 67` |
| `quest` | ObjectId → Quest, required, **immutable** | |
| `user` | ObjectId → User, required | ⬜ replaces the loose `telegramUserId` string |
| `telegramUserId` | String, default null | 🚧 **remove** once `user` exists — denormalised duplicate |
| `createdAt` / `updatedAt` | Date | `createdAt` is the registration time |

**Indexes:**
- `{ quest: 1, number: 1 }` unique ✅ — numbers restart each year, so uniqueness is per quest.
- `{ quest: 1, user: 1 }` unique ⬜ — **the real rule**: one registration per person per quest.
- `{ quest: 1, 'contact.value': 1 }` unique ✅ 🚧 — **reconsider.** Once Telegram identity exists,
  the user is the identity and contact is only a reachability field. Two siblings sharing a phone
  are then wrongly blocked. Recommendation: **drop to non-unique** when `{ quest, user }` lands.
- `{ quest: 1, fullName: 1 }` ⬜ — admin search.

### `counters` ✅

| Field | Type |
|---|---|
| `_id` | String — `participant:<questId>` |
| `value` | Number |

Per-quest keys, so each edition restarts at 3000.

### `results` ⬜ new (Phase 5)

| Field | Type | Notes |
|---|---|---|
| `quest` | ObjectId → Quest, required | |
| `participant` | ObjectId → Participant, required | |
| `score` | Number, required | Correct answers |
| `total` | Number, required | Questions asked — stored so an old result stays readable if the count changes |
| `durationMs` | Number, required | Tiebreaker: speed counts as much as accuracy |
| `rank` | Number, default null | Computed once at publication, then frozen |
| `certificateCode` | String, **unique**, sparse | Short public verification code |
| `submittedAt` | Date, required | |

**Indexes:** `{ quest: 1, participant: 1 }` unique · `{ quest: 1, score: -1, durationMs: 1 }`
(the leaderboard sort, served entirely from the index) · `{ certificateCode: 1 }` unique **partial**
on `{ certificateCode: { $type: 'string' } }`.

> **Corrected during implementation:** this was specified as `sparse`, which is wrong here. A sparse
> index skips documents where the field is *absent*, but an unpublished result stores an explicit
> `null` — so the second unpublished result collides on the unique index. A partial index covering
> only documents where a code actually exists is what was meant. Caught by seeding two results.

**No `certificates` collection.** A certificate is a *view* of participant + quest + result. Storing
it separately creates a second copy of a name that can drift. The only thing worth persisting is the
verification code, which lives on the result.

### Cross-cutting rules

**Relationships.** Everything hangs off `Quest`. `User 1—0..1 Participant` per quest;
`Participant 1—0..1 Result` per quest. References, never embedding — a quest with 1000 embedded
participants would blow past the 16MB document limit and make every Home request read the lot.

**Timestamps.** `timestamps: true` on every collection. Standard `createdAt`/`updatedAt` names —
renaming them (`{ createdAt: 'registeredAt' }`) breaks Mongoose 9's type inference, turning the
inferred type into a `{ [x: string]: NativeDate }` index signature that makes required fields
optional. The DTO renames it instead: `registeredAt: participant.createdAt.toISOString()`.

**Immutable fields.** `participant.number`, `participant.quest`, `quest.edition`, `quest.year`,
`result.score`, `result.submittedAt`. Enforced by never exposing them on an update path — no admin
endpoint accepts them.

**Deletion strategy.** **Nothing in the competition record is ever hard-deleted.** A participant
number is permanent, so deleting a participant leaves a hole in a sequence people can see, and
breaks any certificate already issued. If removal is ever needed, add
`status: 'active' | 'withdrawn'` and filter — the row stays. Only `counters` may be reset, and only
when wiping a development database.

**Audit.** Two admins, low volume: full audit logging is over-engineering. Instead, `updatedAt` on
every document, and admin mutations logged through pino with the acting `telegramUserId`, the route,
and the changed keys. If a real audit trail is wanted later, an `admin_actions` collection is a
clean addition — but it should not be built before it is needed.

---

## 4. Authentication and Telegram verification

### Verifying `initData`

Telegram's Mini App bridge hands the frontend a signed `initData` query string. Verification is the
whole of the security model, so it is written once in `utils/telegram.ts` and never inlined:

1. Parse the query string into key/value pairs. Extract and remove `hash`.
2. Build the **data-check string**: remaining pairs as `key=value`, sorted by key, joined with `\n`.
3. `secret = HMAC_SHA256(key: "WebAppData", data: BOT_TOKEN)`.
4. `expected = HMAC_SHA256(key: secret, data: dataCheckString)`, hex-encoded.
5. Compare `expected` to the supplied `hash` with **`crypto.timingSafeEqual`** — never `===`. A
   plain comparison leaks the hash one byte at a time through response timing.
6. Reject if `now - auth_date > AUTH_INIT_DATA_MAX_AGE_SECONDS` (default 3600). This is the replay
   window: a leaked `initData` string stops working an hour after it was issued.

Any failure is a flat `401 unauthorized` with no detail about which check failed.

> **Replay within the window.** A valid `initData` can be replayed until `auth_date` expires. For
> this product — a reading contest, no money, no destructive operations — the one-hour window is an
> acceptable trade for a stateless check. If that changes, store used `hash` values in a TTL
> collection keyed to `auth_date + maxAge` and reject the second use.

### Session

- On success, upsert the `User` by `telegramUserId`, refresh the profile fields, resolve `role`,
  and issue a **stateless JWT**: `{ sub: <userId>, iat, exp }`, HS256, signed with `JWT_SECRET`,
  7-day expiry.
- **The token carries no role.** `requireAdmin` reads the user from the database on every request.
  A role baked into a token is a role that stays valid after it is revoked.
- Bearer header, not a cookie. A Mini App runs in a webview on a Telegram origin; cross-site cookie
  rules (`SameSite`, third-party blocking) make cookies unreliable there. Bearer also removes CSRF
  as a category, because nothing is sent automatically by the browser.
- No refresh tokens. Re-running the `initData` exchange on `401` is simpler, and inside the Mini App
  it is invisible.

### Admin authorization

Two admins, identified by Telegram ID. The simplest correct mechanism:

```
ADMIN_TELEGRAM_IDS=123456789,987654321
```

Resolved at login into `user.role`, and **re-checked from the database on every admin request** by
`requireAdmin`. No admin-management UI, no role-granting endpoint, no invitations. Changing an admin
is an environment variable and a restart — appropriate for a two-person list, and it means there is
no code path that can escalate a privilege.

`requireAdmin` returns `403 forbidden` for an authenticated non-admin and `401 unauthorized` for no
session. It is applied to the `/admin` router mount, not to individual routes, so a new admin route
cannot be added unprotected by accident.

### TBD-1 — the web fallback

The standalone web app has no `initData`. Three options:

| Option | How | Trade-off |
|---|---|---|
| **A. Read-only web** *(recommended)* | Public endpoints work; registration requires Telegram. Web shows "Continue in Telegram". | Simplest, zero new attack surface. Registration is a Telegram-only action — which matches how the contest is actually run. |
| **B. Telegram Login Widget** | Same HMAC family, different payload (a flat object, and the secret is `SHA256(BOT_TOKEN)` rather than the `WebAppData` HMAC). Roughly 30 extra lines. | Full web parity. Requires a domain registered with BotFather. |
| **C. Magic link / OTP** | Separate identity system. | Contradicts "participants shouldn't need separate accounts". Rejected. |

Recommendation: **A for launch, B when a web audience actually exists.** The API shape is identical
either way, so this does not block the frontend.

---

## 5. Registration and participant ID

### Registration flow

```
POST /participants  (auth required)
  1. requireUser              → 401 if no valid session
  2. rateLimit                → 429 after N attempts per user per hour
  3. validate(shared schema)  → 400 + fields; also NORMALISES name and contact
  4. load current quest       → 404 if none
  5. phase gate               → 409 if registration is closed          (TBD-2)
  6. create()                 → catch E11000 → 409 "already registered as 3047"
  7. $inc participantCount
  8. 201 Participant
```

**Steps 3 and 6 are the two halves of correctness.** Validation and normalisation happen in one zod
`.transform()`, so a service can never receive an un-normalised name — there is no code path that
skips it. Duplicate prevention is the **unique index**, not the `findOne`. The current
check-then-act pattern has a window between the read and the write; under concurrency the index is
what actually holds, so the `E11000` must be translated into a friendly `409` instead of escaping as
a 500 (defect B5).

### Participant ID generation

**Requirements:** exactly 4 digits, starts with `3`, sequential, race-safe, no duplicates, permanent.

**The implemented strategy — keep it.**

```ts
const counter = await CounterModel.findByIdAndUpdate(
  `participant:${questId}`,
  { $inc: { value: 1 } },
  { returnDocument: 'after', upsert: true }
).lean();
return 3000 + counter.value - 1;
```

**Why this is safe, specifically:**

- `findByIdAndUpdate` with `$inc` is a **single atomic document operation**. MongoDB serialises
  concurrent updates to one document, so every caller receives a distinct `value`. Two simultaneous
  registrations cannot read the same number.
- It is **immune to deletion**, because it never reads the participant collection. `count() + 3000`
  breaks the moment one row is removed — it hands out a number that already exists. Even `max() + 1`
  breaks under concurrency, because two readers see the same max before either writes.
- It is **monotonic**: a number is consumed by the `$inc`, not by the successful insert. If a
  registration fails after allocation, that number is skipped forever. **This is correct behaviour.**
  Reusing a skipped number would let a failed registration's number be issued to someone else — a
  gap in a sequence is harmless; a collision is not.
- `upsert: true` means the first registration of a new quest creates its own counter. Nothing needs
  seeding.
- The key is **per quest** (`participant:<questId>`), so each edition restarts at 3000 and last
  year's numbers are untouched.

Exhaustion (`number > 3999`) returns `409 conflict` — "This year's quest is full."

### TBD-5 — the 1000-participant ceiling

`3000–3999` is exactly 1000 slots. The prototype's mock data says 1204 readers. Options:

| Option | Effect |
|---|---|
| **A. Accept the cap** | The contest holds ≤1000 people. Correct the prototype's mock number. Zero code change. |
| **B. 5 digits starting with 3** (`30000–39999`) | 10,000 slots. Changes two constants, the display width in the design, and the "4-digit" rule in the brief. |
| **C. Prefix + sequence** (`3` + zero-padded, overflow into a second range) | Complexity for no real gain. Not recommended. |

**This must be decided before Phase 1 ships**, because changing the range after numbers are issued
means either renumbering people (breaking a permanent, printed-on-a-certificate identifier) or
running two formats at once.

### Contact data model

Keep the current discriminated subdocument:

```ts
contact: { method: 'telegram' | 'phone', value: string }
```

Rather than two nullable columns (`telegramUsername`, `phone`). Reasons: exactly one is always
present, so nullable columns encode an invariant the schema cannot enforce; the value is stored
already normalised, so one index and one comparison serve both kinds; the prefixes (`@` vs `+`) keep
the key spaces disjoint. Adding "email" later is one enum value, not a migration.

The contact is **reachability, not identity**. Once Telegram auth exists, identity is `user`, and
the uniqueness constraint moves accordingly (see the `participants` index notes).

---

## 6. Validation and security

**Validation.** Every route validates through `validate(schema, source)`, which replaces the request
part with the parsed result. A controller therefore *cannot* see raw input. The rules live in
`packages/shared` and are the same functions the browser runs — the client copy is a courtesy, the
server copy is the rule, and they cannot drift because they are one implementation.

**In place today:** helmet · CORS from a comma-separated allowlist · 100kb JSON body cap ·
`x-powered-by` disabled · internal error messages suppressed in production · `strictQuery` ·
boot-time env validation.

**To add:**

| # | Control | Where |
|---|---|---|
| S1 | Auth on `POST /participants` and `GET /participants/:number` | Phase 1 — closes B1 and B4 |
| S2 | Drop `contact` from `ParticipantPublic` | Phase 1 — closes B1 |
| S3 | Rate limiting: registration per user/hour, auth per IP/minute, a global ceiling | Phase 1 |
| S4 | `E11000` → `409 conflict` in the error middleware | Phase 1 — closes B5 |
| S5 | `requireAdmin` on the `/admin` router mount, not per route | Phase 4 |
| S6 | `JWT_SECRET` ≥32 chars, validated at boot | Phase 1 |
| S7 | `timingSafeEqual` for the `initData` hash | Phase 1 |
| S8 | Never log `initData`, tokens, or `contact.value` | Phase 1 — pino redaction paths |
| S9 | Date-ordering validation on admin quest edits | Phase 4 |
| S10 | Mongo user with least privilege in production; not the admin account | Phase 0 |

**Explicitly out of scope, and why:** no password storage (there are no passwords); no email
verification (no email); no CSRF tokens (bearer auth, nothing sent automatically); no per-field
encryption (a phone number in an access-controlled database is proportionate for a reading contest).

---

## 7. Environment variables

**Existing** (`.env.example`, loaded from the repo root via `--env-file-if-exists`):

| Key | Default | Notes |
|---|---|---|
| `NODE_ENV` | `development` | |
| `PORT` | `4000` | Free again on the dev machine — the process that held it is gone. |
| `MONGODB_URI` | `mongodb://127.0.0.1:27017/bookquest` | |
| `CORS_ORIGIN` | `http://localhost:5173` | Comma-separated, so preview URLs need no code change |
| `LOG_LEVEL` | `info` | |
| `TELEGRAM_BOT_TOKEN` | — | Present but unused |
| `VITE_API_URL` | `http://localhost:4000/api/v1` | Web only |

**To add:**

| Key | Required | Notes |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | **yes, from Phase 1** | Promote from optional to required — the secret the whole auth model derives from |
| `JWT_SECRET` | **yes** | ≥32 chars. Rotating it logs everyone out, which is the intended emergency action |
| `JWT_EXPIRES_IN_DAYS` | no (`7`) | A number of days rather than a duration string, so it is validated at boot like everything else |
| `ADMIN_TELEGRAM_IDS` | **yes in production** | Comma-separated. The entire admin model. Empty is a boot failure in production and a startup warning in development, where an admin id is not always to hand |
| `AUTH_INIT_DATA_MAX_AGE_SECONDS` | no (`3600`) | The replay window |
| `RATE_LIMIT_REGISTER_PER_HOUR` | no (`5`) | Keyed per user, not per IP — a school behind one address would otherwise lock itself out |
| `RATE_LIMIT_AUTH_PER_MINUTE` | no (`20`) | Per IP; sign-in is unauthenticated, so there is no user to key on |
| `RATE_LIMIT_GLOBAL_PER_MINUTE` | no (`300`) | A blunt ceiling per IP across `/api/v1` |
| `WEB_APP_URL` | no | Absolute URL for certificate links and bot messages |

---

## Frontend ↔ Backend API contract

> This section is **identical** in `FRONTEND-SPEC.md` and `BACKEND-SPEC.md`. Change it in both or in
> neither. `✅` = built and working today. `🚧` = exists but changes in this plan. `⬜` = not built.
>
> **Status: the backend now implements every endpoint below.** The markers record what changed
> relative to the pre-plan service, not what is missing. Frontend consumption is tracked in
> `FRONTEND-PLAN.md`.

### Conventions

- Base URL: `/api/v1`. Versioned at the router mount, so a v2 is a new mount, not a rewrite.
- All dates are **ISO-8601 UTC strings** over the wire. The client converts to `Date` at the API
  boundary; nothing downstream guesses which representation it holds.
- Auth, where required: `Authorization: Bearer <token>`.
- Every response uses one envelope:

```jsonc
// success
{ "ok": true, "data": { /* ... */ } }

// failure
{ "ok": false, "error": {
    "code": "validation_failed",
    "message": "Please enter your first and last name.",
    "fields": { "fullName": "Please enter your first and last name." }  // optional
} }
```

- `error.message` is safe to show a user verbatim — messages are written for people, not for logs.
- `error.fields` maps a field path to a message and is present only on `validation_failed`. Forms
  drop it straight onto inputs.

### Error codes → status

| `code` | Status | Meaning |
|---|---|---|
| `validation_failed` | 400 | Input rejected. Carries `fields`. |
| `unauthorized` | 401 | No session, or the session is invalid/expired. Client should re-authenticate. |
| `forbidden` | 403 | Authenticated, but not allowed. Used for admin-only routes. |
| `not_found` | 404 | No such quest, participant, or route. |
| `conflict` | 409 | Already registered; quest full; quiz already submitted. |
| `rate_limited` | 429 | Too many attempts. Carries `Retry-After`. |
| `internal_error` | 500 | Bug. Message is generic in production. |

### Shared types

Defined once in `packages/shared`, imported by both sides. Names below match the exported types.

```ts
type QuestPhase = 'upcoming' | 'reading' | 'quiz' | 'finished';
type ContactMethod = 'telegram' | 'phone';
type Role = 'participant' | 'admin';                        // ⬜ new

interface Book {                                            // 🚧 gains 3 fields
  title: string;
  author: string;
  pages: number;
  coverUrl: string | null;
  description: string | null;                               // ⬜ new — admin-editable
  resources: BookResource[];                                // ⬜ new — admin-editable
}

interface BookResource {                                    // ⬜ new
  label: string;                    // "PDF (English)", "Audiobook"
  url: string;
  kind: 'pdf' | 'epub' | 'audio' | 'link';
}

interface Prizes {                                          // ⬜ new — admin-editable
  first: string | null;             // free text: "AirPods Pro", "500,000 so'm"
  second: string | null;
  third: string | null;
}

interface Quest {                                           // 🚧 gains prizes + quiz fields
  id: string;
  edition: number;
  year: number;
  phase: QuestPhase;                // derived server-side from the clock, never stored
  book: Book;
  prizes: Prizes;                                           // ⬜ new
  opensAt: string;
  readingDeadline: string;
  quizOpensAt: string;
  quizClosesAt: string;
  resultsAt: string;
  quizQuestionCount: number | null;                         // ⬜ new — for "20 questions" copy
  quizDurationMinutes: number | null;                       // ⬜ new
  participantCount: number;
}

interface QuestSummary {                                    // ⬜ new — archive list
  id: string;
  edition: number;
  year: number;
  bookTitle: string;
  bookAuthor: string;
  coverUrl: string | null;
  participantCount: number;
  winner: { number: number; fullName: string } | null;
}

interface Contact {
  method: ContactMethod;
  value: string;                    // normalised: "@sofia_k" or "+998 90 123 45 67"
}

interface Participant {             // self-view only — includes contact
  id: string;
  number: number;                   // 4 digits, 3000–3999
  fullName: string;
  contact: Contact;
  questId: string;
  registeredAt: string;
}

interface ParticipantPublic {       // ⬜ new — everyone else's view. No contact, ever.
  number: number;
  fullName: string;
}

interface SessionUser {                                     // ⬜ new
  id: string;
  telegramUserId: string;
  firstName: string;
  username: string | null;
  photoUrl: string | null;
  role: Role;
  participant: Participant | null;  // null until they register for the current quest
}

interface ResultEntry {                                     // ⬜ new
  rank: number;
  number: number;
  fullName: string;
  score: number;                    // correct answers
  total: number;                    // questions asked
  durationMs: number;               // tiebreaker — speed counts
}

interface CertificateData {                                 // ⬜ new
  code: string;                     // short public verification code
  fullName: string;
  participantNumber: number;
  questEdition: number;
  questYear: number;
  bookTitle: string;
  bookAuthor: string;
  rank: number | null;              // null = completion certificate, not a placing
  issuedAt: string;
}
```

### Endpoints

---

#### `GET /health` ✅

Outside the versioned API. No auth. Liveness only.

`200` → `{ "ok": true, "data": { "status": "up", "uptime": 1234.5 } }`

---

#### `POST /api/v1/auth/telegram` ⬜

Exchanges Telegram-provided identity for a session. The **only** way to obtain a token.

**Auth:** none (this is the entry point).

**Body:**
```jsonc
{ "initData": "query_id=...&user=%7B...%7D&auth_date=1757000000&hash=abc..." }
```

The raw `initData` string, unparsed. Backend verifies the HMAC-SHA256 signature with a key derived
from the bot token, compares in constant time, and rejects anything whose `auth_date` is older than
`AUTH_INIT_DATA_MAX_AGE_SECONDS`.

**`200`** →
```jsonc
{ "ok": true, "data": {
    "token": "<jwt>",
    "expiresAt": "2026-09-15T10:00:00.000Z",
    "user": { /* SessionUser */ }
} }
```

**Errors:** `401 unauthorized` (bad hash, stale `auth_date`, malformed `initData`),
`429 rate_limited`, `500 internal_error`.

> **TBD-1 — resolved: read-only web.** Standalone web has no `initData`, so it can call the public
> endpoints but cannot register; the frontend must render that state rather than assume a session.
> The Telegram Login Widget (option B) remains available later and needs no contract change.

---

#### `GET /api/v1/auth/me` ⬜

Who the bearer token belongs to, re-read from the database. Never trusts claims in the token beyond
the user id.

**Auth:** required.

**`200`** → `{ "ok": true, "data": { /* SessionUser */ } }`

**Errors:** `401 unauthorized`.

---

#### `GET /api/v1/quests/current` ✅ 🚧

The Home screen's single source of truth: book, deadline, prizes, phase, reader count.

**Auth:** none. Content is public.

**`200`** → `{ "ok": true, "data": { /* Quest */ } }`

**Errors:** `404 not_found` — "No quest is running right now." The frontend renders a real empty
state for this; it is a normal condition between editions, not a failure.

**Caching:** `Cache-Control: public, max-age=30`. Client `staleTime` 30s.

> `phase` is computed per request from the clock, so a client that polls gets the transition
> without a deploy or a cron job.

---

#### `GET /api/v1/quests` ⬜

The Past Quests archive.

**Auth:** none.

**Query:** `limit` (default 20, max 50), `cursor` (opaque; omit for the first page).

**`200`** → `{ "ok": true, "data": { "items": QuestSummary[], "nextCursor": string | null } }`

Newest first. Excludes the current quest.

---

#### `GET /api/v1/quests/:edition` ⬜

One past edition. `:edition` is the integer edition number, not a database id — it is the number
people actually say out loud.

**Auth:** none.

**`200`** → `{ "ok": true, "data": { /* Quest */ } }` · **Errors:** `404 not_found`.

---

#### `POST /api/v1/participants` ✅ 🚧

Register for the current quest. Allocates the participant number.

**Auth:** 🚧 **none today — becomes required.** See TBD-1.

**Body:**
```jsonc
{
  "fullName": "  sofia   karimova ",
  "contactMethod": "telegram",
  "contactValue": "@sofia_k"
}
```

**Validation** (shared package, run identically on both sides):
- `fullName` — exactly two words, letters/hyphens/apostrophes only, no digits, each word ≥2 letters,
  rejects keyboard runs and vowel-starved strings. Normalised to title case on success.
- `contactValue` — parsed as a Telegram username or a phone number depending on `contactMethod`.
  Normalised to `@username` or a grouped `+998 90 123 45 67`.

**`201`** → `{ "ok": true, "data": { /* Participant */ } }` — the response is the **only** source of
the participant number. The frontend never computes or guesses it.

**Errors:**
- `400 validation_failed` with `fields`, keyed `fullName` / `contactValue`.
- `409 conflict` — "That contact is already registered as participant 3047." / "This year's quest is full."
- `404 not_found` — no current quest.
- `429 rate_limited`.

> **TBD-2 — resolved: registration closes at `readingDeadline`**, matching the prototype's own copy
> — *"Registration closes when the reading period ends."* A request after it is `409 conflict`,
> "Registration for this year has closed." Registering later would hand someone a number for a quiz
> they cannot reach.

---

#### `GET /api/v1/participants/me` ⬜

The caller's own registration for the current quest. Replaces client-side caching of the number as
the source of truth.

**Auth:** required.

**`200`** → `{ "ok": true, "data": { /* Participant */ } }` — includes `contact`.

**Errors:** `401 unauthorized`, `404 not_found` (authenticated but not registered — a normal state,
the frontend routes to registration).

---

#### `GET /api/v1/participants/:number` ✅ 🚧

Look up another participant.

**Auth:** 🚧 **none today — becomes required.**

**`200`** → `{ "ok": true, "data": { /* ParticipantPublic */ } }`

> 🚧 **Breaking change, and the reason for it.** This endpoint currently returns `fullName` **and**
> `contact.value` with no authentication. Numbers are sequential from 3000, so 1000 requests
> enumerate every participant's name and phone number. The response type narrows to
> `ParticipantPublic` and the route requires a session. Self-lookup moves to `/participants/me`.

**Errors:** `401 unauthorized`, `404 not_found`.

---

#### `GET /api/v1/quests/current/results` ⬜

Podium and leaderboard. Available only once results are published.

**Auth:** none.

**`200`** →
```jsonc
{ "ok": true, "data": {
    "podium": [ /* ResultEntry × up to 3 */ ],
    "leaderboard": [ /* ResultEntry[] */ ],
    "publishedAt": "2026-09-22T07:00:00.000Z"
} }
```

**Errors:** `404 not_found` before `resultsAt` — results that do not exist yet are not found, not
forbidden. The frontend shows "Results are published on 22 September".

---

#### `GET /api/v1/participants/me/certificate` ⬜

The data a certificate is rendered from. Everyone who completed the quiz gets one.

**Auth:** required.

**`200`** → `{ "ok": true, "data": { /* CertificateData */ } }`

**Errors:** `401 unauthorized`, `404 not_found` (did not complete the quiz, or results not published).

> **TBD-3 — resolved for now: client-rendered.** Only this JSON endpoint exists. Server-side
> rendering would put a headless browser in the API for a once-a-year artifact; if it is ever wanted,
> it is an additional URL, not a change to this one.

---

#### `GET /api/v1/admin/participants` ⬜

**Auth:** required, `role === 'admin'`, enforced server-side on every call.

**Query:** `q` (name or number substring), `questId` (default: current), `page` (default 1),
`limit` (default 50, max 200).

**`200`** →
```jsonc
{ "ok": true, "data": {
    "items": [ /* Participant[] — includes contact; admins need to reach people */ ],
    "page": 1, "limit": 50, "total": 412
} }
```

**Errors:** `401 unauthorized`, `403 forbidden`.

---

#### `PATCH /api/v1/admin/quests/:id` ⬜

Edit the admin-owned content of a quest: book, dates, prizes, quiz metadata.

**Auth:** required, `role === 'admin'`.

**Body:** any subset of —
```jsonc
{
  "book": { "title": "...", "author": "...", "pages": 197, "coverUrl": "...",
            "description": "...", "resources": [ { "label": "...", "url": "...", "kind": "pdf" } ] },
  "prizes": { "first": "...", "second": "...", "third": "..." },
  "opensAt": "2026-08-01T09:00:00.000Z",
  "readingDeadline": "2026-09-20T18:59:00.000Z",
  "quizOpensAt": "...", "quizClosesAt": "...", "resultsAt": "...",
  "quizQuestionCount": 20, "quizDurationMinutes": 30
}
```

**`200`** → `{ "ok": true, "data": { /* Quest */ } }`

**Errors:** `400 validation_failed` (including date-ordering violations —
`opensAt < readingDeadline ≤ quizOpensAt < quizClosesAt ≤ resultsAt`), `401`, `403`, `404`.

> `edition`, `year` and `participantCount` are **not** editable. Edition and year are identity;
> `participantCount` is maintained by the registration path.

---

#### `POST /api/v1/admin/quests` ⬜ · `POST /api/v1/admin/quests/:id/make-current` ⬜

Create next year's edition, and switch which one is current (in a transaction, so there is never
zero or two current quests).

**Auth:** required, `role === 'admin'`.

**Body:** `{ "makeCurrent"?: boolean }`
- `makeCurrent` (default `false`). When `true`, the new quest becomes current in the same transaction.

**`200`/`201`** → `Quest`.

---

#### `GET /api/v1/admin/stats` ⬜

Dashboard numbers: registrations today, total, quiz submissions, completion rate.

**Auth:** required, `role === 'admin'`.

**`200`** → `{ "ok": true, "data": { "participants": 412, "registeredToday": 17, "quizSubmitted": 0, "phase": "reading" } }`

---

#### `POST /api/v1/admin/broadcasts` ⬜

Send a broadcast to participants. Every user gets it in-app; users with Telegram linked also get a DM. Delivery is asynchronous — DMs are sent after the response.

**Auth:** required, `role === 'admin'`.

**Body:** `{ "message": string (trimmed, 1–1000 chars) }`

**`202 Accepted`** → `{ "ok": true, "data": { /* Broadcast */ } }`
- `status` is `"sending"` on POST; updates to `"sent"` or `"interrupted"` as delivery progresses.

---

#### `GET /api/v1/admin/broadcasts` ⬜

List sent broadcasts and delivery status.

**Auth:** required, `role === 'admin'`.

**`200`** → `{ "ok": true, "data": { "items": [ /* Broadcast[] (latest 20) */ ], "audience": 412, "dmAudience": 127 } }`

**On boot:** any `sending` broadcasts are marked `interrupted`.

---

### Not in this contract

The quiz — question delivery, answer submission, scoring, anti-cheat, timing — is a separate future
plan. No quiz endpoints are defined here beyond the metadata (`quizOpensAt`, `quizQuestionCount`)
the Home screen needs to describe it. Neither side should build against an imagined quiz API.
