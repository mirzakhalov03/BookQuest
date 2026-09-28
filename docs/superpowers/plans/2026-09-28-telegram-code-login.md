# Telegram Code Login + `/me` Join Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Telegram users sign in to the web with a 6-digit code the bot sends them, and `/me` becomes the only place to join a quest (join form → number reveal → profile), replacing `/register`.

**Architecture:** A new `LoginCode` Mongo model (hashed code, TTL expiry, attempt counter) behind two endpoints, `POST /auth/telegram-code/request` and `/verify`. Both end in the existing `issueSession`. On the web, `AuthScreen` gets "New here" / "I'm registered" tabs using the existing `Switch`. `ProfilePage` renders the existing `RegistrationForm` inline when the user hasn't joined, and the reveal moves to `/me/welcome`.

**Tech Stack:** Express + TypeScript + Mongoose + Zod (`apps/api`), shared Zod schemas (`packages/shared`), React + Vite + Tailwind + React Query (`apps/web`).

**Spec:** `docs/superpowers/specs/2026-09-28-telegram-code-login-design.md`

## Global Constraints

- No automated tests (project preference). Each task is verified by typecheck plus the manual checks it lists.
- `packages/shared` is consumed from its build output: after changing it, run `pnpm --filter @bookquest/shared build` before typechecking `apps/api` or `apps/web`.
- Code: 6 digits, `crypto.randomInt`; stored only as `HMAC-SHA256(LOGIN_CODE_SECRET, code)`; expires after **10 minutes**; **5** attempts; **60s** resend cooldown per user; single use; timing-safe compare.
- Bot message, verbatim: `Your BookQuest login code: {code}. It expires in 10 minutes. If you didn't ask for this, ignore this message.`
- User-facing copy, verbatim:
  - no match: `We couldn't find anyone with that.`
  - ambiguous: `That matches more than one person — try your reg number or @username.`
  - no Telegram: `That account isn't connected to Telegram — log in with your password.`
  - cooldown: `Wait a minute before asking for another code.`
  - bot can't reach them: `We couldn't reach your Telegram. Open the BookQuest bot in Telegram, tap Start, then try again.`
  - expired: `That code expired. Send a new one.`
  - wrong code: `That code isn't right — {n} tries left.` (`try` when n = 1)
- Backend naming: `*.services.ts`, `*.controllers.ts`, `*.routes.ts`, `*.validators.ts`, `*.model.ts`.
- Comments: concise one-liners that explain *why*.
- Every commit message ends with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Commit only the files the task names (`git add <paths>`); the tree has unrelated uncommitted work.

### Deviations from the spec (decided while planning)

- **Bot handle:** the API has no bot-username env var, so the "can't reach you" copy says "the BookQuest bot" rather than `@<bot>`. This avoids a new env var.
- **Header component:** the shared gradient header is `components/HeroBanner.tsx` (class `.hero-banner`), not `lib/auth/AuthHero.tsx`. It's a layout piece used by auth *and* profile, not auth logic.
- **Edition mark CSS:** `.edition` / `.edition__mark` CSS is **kept**, because the edition mark moves into the hero. Only `.view--register`, `.titlepage*`, `.lede` and the ≥880px title-page block are deleted.
- **Closed registration:** when a quest is running but registration has closed (phase `quiz` / `finished`), `/me` shows the slim profile with a "registration has closed" note. The spec only covered "no quest".
- **Participant query key:** moved to `lib/api/participant.ts` so the join flow can seed the participant cache after registering. Otherwise the profile flashes the join form on return from the reveal.
- **New error codes:** `expired` (410) and `unprocessable` (422) are added to `API_ERROR_CODES`.
- **Home page button:** `QuestAction`'s open-web branch (the Telegram widget) is replaced by the same "Join BookQuest" → `/me` button, since `/me` now handles signing in.

## Review Focus

1. **Parallel wrong guesses** (two tabs, or a script): the attempt cap must hold, so the counter is incremented atomically *before* comparing (Task 3, step 3 check).
2. **Reg number formats** `142`, `0142` and `#0142` must all find participant 142 (Task 3, step 5 check).
3. **Username casing and `@`**: `@Sofia_K`, `sofia_k` and a stored contact `@sofia_k` must all match the same user (Task 3 regex; step 5 check).
4. **Returning from the reveal** must show the profile with the new number immediately, with no flash of the join form (Task 6 seeds the participant cache; step 9 check).
5. **Direct visit to `/me/welcome`** with no number to reveal goes to `/me`; a signed-out visitor sees `AuthScreen` (Task 6, step 9 check).

---

## File Structure

**packages/shared**
- Modify `src/api.ts`: add the `expired` and `unprocessable` error codes
- Modify `src/schemas/auth.ts`: code request/verify schemas and the `TelegramCodeChallenge` type

**apps/api**
- Modify `src/config/env.ts` and root `.env.example`: `LOGIN_CODE_SECRET`
- Modify `src/utils/api-error.ts`: `ApiError.gone`, `ApiError.unprocessable`
- Create `src/models/login-code.model.ts`: the short-lived code record
- Create `src/services/login-code.services.ts`: resolve the identifier, request, verify
- Modify `src/services/auth.services.ts`: export `issueSession`
- Modify `src/validators/auth.validators.ts`, `src/controllers/auth.controllers.ts`, `src/routes/auth.routes.ts`

**apps/web**
- Modify `src/lib/auth/authApi.ts`: `requestTelegramCode`, `verifyTelegramCode`
- Create `src/lib/auth/TelegramCodeLogin.tsx`: the two-step code form
- Create `src/components/HeroBanner.tsx`: the gradient header
- Modify `src/lib/auth/AuthScreen.tsx`: tabs
- Modify `src/lib/auth/PhoneAuthForm.tsx`: `mode` only
- Create `src/lib/api/participant.ts`: participant keys and hook (moved)
- Delete `src/features/profile/api/useParticipant.ts`
- Create `src/features/registration/JoinQuest.tsx`: header + `RegistrationForm`
- Modify `src/features/profile/ProfilePage.tsx`: inline join and the slim profile
- Modify `src/features/registration/components/RegistrationForm.tsx`, `SuccessScreen.tsx`, `api/useRegister.ts`
- Modify `src/app/router.tsx`, `src/layouts/AppLayout.tsx`, `src/features/home/components/QuestAction.tsx`
- Delete `src/features/registration/RegisterPage.tsx`
- Modify `src/styles/register.css`: remove title-page CSS; rename `.auth-hero` → `.hero-banner`

---

### Task 1: Shared contract — schemas and error codes

**Files:**
- Modify: `packages/shared/src/api.ts` (`API_ERROR_CODES`, around line 23)
- Modify: `packages/shared/src/schemas/auth.ts` (append after `PhoneLoginPayload`)

**Interfaces:**
- Produces: `telegramCodeRequestSchema`, `TelegramCodeRequestPayload`, `telegramCodeVerifySchema`, `TelegramCodeVerifyPayload`, `TelegramCodeChallenge { challengeId: string; sentTo: string }`, and the error codes `'expired' | 'unprocessable'`.

- [ ] **Step 1: Add the error codes**

In `packages/shared/src/api.ts`, replace the `API_ERROR_CODES` array with:

```ts
export const API_ERROR_CODES = [
  'validation_failed',
  'not_found',
  'conflict',
  'unauthorized',
  /** Authenticated, but not allowed — admin-only routes. */
  'forbidden',
  /** Existed once, gone now — an expired or used-up login code. */
  'expired',
  /** Understood, but can't be done for this account — e.g. no Telegram to send a code to. */
  'unprocessable',
  'rate_limited',
  'internal_error'
] as const;
```

- [ ] **Step 2: Add the code schemas**

Append to `packages/shared/src/schemas/auth.ts`:

```ts
/** Reg number, phone or @username — the server works out which. */
export const telegramCodeRequestSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(1, 'Enter your reg number, phone or @username.')
    .max(64, 'That’s longer than any of those can be.')
});

export type TelegramCodeRequestPayload = z.infer<typeof telegramCodeRequestSchema>;

export const telegramCodeVerifySchema = z.object({
  challengeId: z.string().min(1),
  code: z.string().trim().regex(/^\d{6}$/, 'Enter the 6-digit code.')
});

export type TelegramCodeVerifyPayload = z.infer<typeof telegramCodeVerifySchema>;

export interface TelegramCodeChallenge {
  challengeId: string;
  /** Masked destination, e.g. "@sof…", so the user knows which Telegram to check. */
  sentTo: string;
}
```

- [ ] **Step 3: Build and typecheck**

Run: `pnpm --filter @bookquest/shared build && pnpm --filter @bookquest/api typecheck && pnpm --filter @bookquest/web typecheck`
Expected: all three exit 0. If a `switch` over `ApiErrorCode` fails to be exhaustive, add the two new cases there with the same handling as `conflict`.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/api.ts packages/shared/src/schemas/auth.ts
git commit -m "feat(shared): telegram login code schemas and expired/unprocessable error codes

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 2: API foundation — env, errors, LoginCode model

**Files:**
- Modify: `apps/api/src/config/env.ts` (inside `envSchema`, after `BOT_SERVICE_TOKEN`)
- Modify: `.env.example` (after the `BOT_SERVICE_TOKEN=` block)
- Modify: `apps/api/src/utils/api-error.ts`
- Create: `apps/api/src/models/login-code.model.ts`

**Interfaces:**
- Consumes: the error codes `'expired'` and `'unprocessable'` from Task 1.
- Produces: `env.LOGIN_CODE_SECRET: string`, `ApiError.gone(message)`, `ApiError.unprocessable(message)`, `LoginCodeModel`, `LoginCodeDocument`.

- [ ] **Step 1: Env var**

In `apps/api/src/config/env.ts`, add after `BOT_SERVICE_TOKEN`:

```ts
  /** HMAC key for login codes — the DB only ever holds the hash. Generate with: openssl rand -hex 32 */
  LOGIN_CODE_SECRET: z.string().min(32, 'LOGIN_CODE_SECRET must be at least 32 characters'),
```

In `.env.example`, after the `BOT_SERVICE_TOKEN=` line:

```
# HMAC key for Telegram login codes — the database only stores the hash.
# Generate with: openssl rand -hex 32
LOGIN_CODE_SECRET=
```

Then add a real value to the local `.env`: `echo "LOGIN_CODE_SECRET=$(openssl rand -hex 32)" >> .env` (run from the repo root).

- [ ] **Step 2: ApiError helpers**

In `apps/api/src/utils/api-error.ts`, add before `tooManyRequests`:

```ts
  static gone(message: string): ApiError {
    return new ApiError(410, 'expired', message);
  }

  static unprocessable(message: string): ApiError {
    return new ApiError(422, 'unprocessable', message);
  }
```

- [ ] **Step 3: The model**

Create `apps/api/src/models/login-code.model.ts`:

```ts
import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** One pending Telegram login code. Short-lived by design: the TTL index sweeps expired rows. */
const loginCodeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /* HMAC of the code, never the code itself. */
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }
  },
  // `createdAt` drives the resend cooldown.
  { timestamps: true }
);

// The sweep can lag about a minute, so reads still check `expiresAt` themselves.
loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginCodeAttributes = InferSchemaType<typeof loginCodeSchema>;
export type LoginCodeDocument = HydratedDocument<LoginCodeAttributes>;
export const LoginCodeModel = model('LoginCode', loginCodeSchema);
```

- [ ] **Step 4: Typecheck and boot**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exit 0.

The running `tsx watch` API on :4000 restarts on save. It needs the new env var, so restart it if it was started before Step 1. Then run `curl -s localhost:4000/api/v1/auth/me`.
Expected: a JSON `unauthorized` error, not a connection refusal. That shows the server booted with the new env.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/config/env.ts .env.example apps/api/src/utils/api-error.ts apps/api/src/models/login-code.model.ts
git commit -m "feat(api): LoginCode model, LOGIN_CODE_SECRET, gone/unprocessable errors

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 3: API — request/verify service, controller, routes

**Files:**
- Create: `apps/api/src/services/login-code.services.ts`
- Modify: `apps/api/src/services/auth.services.ts` (`async function issueSession` → `export async function issueSession`)
- Modify: `apps/api/src/validators/auth.validators.ts`
- Modify: `apps/api/src/controllers/auth.controllers.ts`
- Modify: `apps/api/src/routes/auth.routes.ts`

**Interfaces:**
- Consumes: `LoginCodeModel`, `ApiError.gone/unprocessable`, `env.LOGIN_CODE_SECRET` (Task 2); shared schemas (Task 1); `sendTelegramMessage(telegramUserId, text): Promise<boolean>` (`utils/telegram-send.ts`); `findCurrentQuestDocument()` (`services/quest.services.ts`); `parsePhoneNumber` / `parseTelegramUsername` (shared; phones normalise to the grouped `+998 90 123 45 67` form, usernames to `@name`).
- Produces: `POST /api/v1/auth/telegram-code/request` → `TelegramCodeChallenge`; `POST /api/v1/auth/telegram-code/verify` → `Session`.

- [ ] **Step 1: Export `issueSession`**

In `apps/api/src/services/auth.services.ts`, change `async function issueSession(` to `export async function issueSession(`.

- [ ] **Step 2: The service**

Create `apps/api/src/services/login-code.services.ts`:

```ts
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { isValidObjectId } from 'mongoose';
import {
  parsePhoneNumber,
  parseTelegramUsername,
  type Session,
  type TelegramCodeChallenge
} from '@bookquest/shared';
import { env } from '../config/env.js';
import { LoginCodeModel } from '../models/login-code.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel, type UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { sendTelegramMessage } from '../utils/telegram-send.js';
import { issueSession } from './auth.services.js';
import { findCurrentQuestDocument } from './quest.services.js';

const CODE_TTL_MS = 10 * 60_000;
const RESEND_COOLDOWN_MS = 60_000;
const MAX_ATTEMPTS = 5;

const REG_NUMBER = /^#?\d{1,4}$/;
const USERNAME_LIKE = /^[A-Za-z][A-Za-z0-9_]{4,31}$/;

const EXPIRED = 'That code expired. Send a new one.';

const hashCode = (code: string): string =>
  createHmac('sha256', env.LOGIN_CODE_SECRET).update(code).digest('hex');

// Both sides are fixed-length hex digests, so the lengths always match.
const codeMatches = (hash: string, code: string): boolean =>
  timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(hashCode(code), 'hex'));

const unique = (ids: string[]): string[] => [...new Set(ids)];

function invalidIdentifier(message: string): ApiError {
  return ApiError.badRequest(message, { identifier: message });
}

/** Every user id the identifier could mean. Contacts span all editions, so older participants still match. */
async function findCandidateUserIds(identifier: string): Promise<string[]> {
  const raw = identifier.trim();

  if (REG_NUMBER.test(raw)) {
    const quest = await findCurrentQuestDocument();
    if (!quest) return [];
    const participant = await ParticipantModel.findOne(
      { quest: quest._id, number: Number(raw.replace('#', '')) },
      'user'
    );
    return participant ? [participant.user.toString()] : [];
  }

  if (raw.startsWith('@') || USERNAME_LIKE.test(raw)) {
    const parsed = parseTelegramUsername(raw);
    if (!parsed.ok) throw invalidIdentifier(parsed.message);
    // Safe to build a RegExp from: the parser only lets [A-Za-z0-9_] through.
    const pattern = new RegExp(`^@?${parsed.value.slice(1)}$`, 'i');
    const [users, participants] = await Promise.all([
      UserModel.find({ username: pattern }, '_id'),
      ParticipantModel.find({ 'contact.method': 'telegram', 'contact.value': pattern }, 'user')
    ]);
    return unique([...users.map((u) => u.id as string), ...participants.map((p) => p.user.toString())]);
  }

  const phone = parsePhoneNumber(raw);
  if (!phone.ok) throw invalidIdentifier(phone.message);
  const digits = phone.value.replace(/\D/g, '');
  const [users, participants] = await Promise.all([
    // Phone accounts store what the login form accepted: with or without the `+`.
    UserModel.find({ phoneNumber: { $in: [`+${digits}`, digits] } }, '_id'),
    ParticipantModel.find({ 'contact.method': 'phone', 'contact.value': phone.value }, 'user')
  ]);
  return unique([...users.map((u) => u.id as string), ...participants.map((p) => p.user.toString())]);
}

async function resolveLoginUser(identifier: string): Promise<UserDocument & { telegramUserId: string }> {
  const ids = await findCandidateUserIds(identifier);

  if (ids.length === 0) throw ApiError.notFound("We couldn't find anyone with that.");
  // A shared family phone — guessing whose Telegram gets the code would be worse than asking.
  if (ids.length > 1) {
    throw ApiError.conflict('That matches more than one person — try your reg number or @username.');
  }

  const user = await UserModel.findById(ids[0]);
  if (!user) throw ApiError.notFound("We couldn't find anyone with that.");
  if (!user.telegramUserId) {
    throw ApiError.unprocessable("That account isn't connected to Telegram — log in with your password.");
  }
  return user as UserDocument & { telegramUserId: string };
}

function maskUsername(username: string | null | undefined): string {
  return username ? `@${username.slice(0, 3)}…` : 'your Telegram';
}

/** POST /auth/telegram-code/request */
export async function requestLoginCode(identifier: string): Promise<TelegramCodeChallenge> {
  const user = await resolveLoginUser(identifier);

  // Stops anyone from flooding another person's Telegram with codes.
  const recent = await LoginCodeModel.exists({
    user: user._id,
    createdAt: { $gt: new Date(Date.now() - RESEND_COOLDOWN_MS) }
  });
  if (recent) throw ApiError.tooManyRequests('Wait a minute before asking for another code.');

  // One live code per person: asking again retires the old one.
  await LoginCodeModel.deleteMany({ user: user._id });

  const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
  const loginCode = await LoginCodeModel.create({
    user: user._id,
    codeHash: hashCode(code),
    expiresAt: new Date(Date.now() + CODE_TTL_MS)
  });

  const sent = await sendTelegramMessage(
    user.telegramUserId,
    `Your BookQuest login code: ${code}. It expires in 10 minutes. If you didn't ask for this, ignore this message.`
  );
  if (!sent) {
    await loginCode.deleteOne();
    throw ApiError.unprocessable(
      "We couldn't reach your Telegram. Open the BookQuest bot in Telegram, tap Start, then try again."
    );
  }

  return { challengeId: loginCode.id as string, sentTo: maskUsername(user.username) };
}

/** POST /auth/telegram-code/verify */
export async function verifyLoginCode(challengeId: string, code: string): Promise<Session> {
  if (!isValidObjectId(challengeId)) throw ApiError.gone(EXPIRED);

  // Count the attempt before comparing, atomically, so parallel guesses can't slip past the cap.
  const loginCode = await LoginCodeModel.findOneAndUpdate(
    { _id: challengeId, expiresAt: { $gt: new Date() }, attempts: { $lt: MAX_ATTEMPTS } },
    { $inc: { attempts: 1 } },
    { returnDocument: 'after' }
  );
  if (!loginCode) throw ApiError.gone(EXPIRED);

  if (!codeMatches(loginCode.codeHash, code)) {
    const left = MAX_ATTEMPTS - loginCode.attempts;
    if (left <= 0) {
      await loginCode.deleteOne();
      throw ApiError.gone(EXPIRED);
    }
    const message = `That code isn't right — ${left} ${left === 1 ? 'try' : 'tries'} left.`;
    throw ApiError.badRequest(message, { code: message });
  }

  // Single use.
  await loginCode.deleteOne();

  const user = await UserModel.findById(loginCode.user);
  if (!user) throw ApiError.gone(EXPIRED);
  return issueSession(user);
}
```

- [ ] **Step 3: Validators, controller, routes**

In `apps/api/src/validators/auth.validators.ts`, add `telegramCodeRequestSchema` and `telegramCodeVerifySchema` to the import, and append:

```ts
export const telegramCodeRequestBody = telegramCodeRequestSchema;
export const telegramCodeVerifyBody = telegramCodeVerifySchema;
```

In `apps/api/src/controllers/auth.controllers.ts`, add `TelegramCodeRequestPayload` and `TelegramCodeVerifyPayload` to the type import, add `import * as loginCodeService from '../services/login-code.services.js';`, and append:

```ts
/** POST /api/v1/auth/telegram-code/request */
export async function requestTelegramCode(req: Request, res: Response): Promise<void> {
  const { identifier } = req.body as TelegramCodeRequestPayload;
  ok(res, await loginCodeService.requestLoginCode(identifier));
}

/** POST /api/v1/auth/telegram-code/verify */
export async function verifyTelegramCode(req: Request, res: Response): Promise<void> {
  const { challengeId, code } = req.body as TelegramCodeVerifyPayload;
  ok(res, await loginCodeService.verifyLoginCode(challengeId, code));
}
```

In `apps/api/src/routes/auth.routes.ts`, add `telegramCodeRequestBody` and `telegramCodeVerifyBody` to the validators import, and add after the `/login` route:

```ts
authRoutes.post(
  '/telegram-code/request',
  authRateLimit,
  validate(telegramCodeRequestBody),
  authController.requestTelegramCode
);

authRoutes.post(
  '/telegram-code/verify',
  authRateLimit,
  validate(telegramCodeVerifyBody),
  authController.verifyTelegramCode
);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exit 0.

- [ ] **Step 5: Exercise the endpoints with curl** (the API on :4000 has reloaded)

```bash
R=localhost:4000/api/v1/auth/telegram-code
curl -s -XPOST $R/request -H 'content-type: application/json' -d '{"identifier":""}'          # 400 validation_failed, fields.identifier
curl -s -XPOST $R/request -H 'content-type: application/json' -d '{"identifier":"9999"}'      # treated as reg number → 404 if #9999 doesn't exist
curl -s -XPOST $R/request -H 'content-type: application/json' -d '{"identifier":"12345"}'     # treated as phone → 400 fields.identifier "That number looks a few digits short."
curl -s -XPOST $R/request -H 'content-type: application/json' -d '{"identifier":"@nobody_here_x"}'  # 404 "We couldn't find anyone with that."
curl -s -XPOST $R/verify  -H 'content-type: application/json' -d '{"challengeId":"nope","code":"123456"}'  # 410 expired
curl -s -XPOST $R/verify  -H 'content-type: application/json' -d '{"challengeId":"x","code":"12"}'         # 400 fields.code "Enter the 6-digit code."
```

Then with a real account whose Telegram is your own (sign in once through the Mini App so the user row exists with your `telegramUserId`, and join the quest to get a number):
- Request with your reg number written three ways, `142`, `0142` and `#0142` (substitute your number) → each returns `{ challengeId, sentTo }`. **Wait 60s between requests**, or expect the 429 cooldown message, which is itself a check.
- Request with your @username in different casing, with and without `@` → same user.
- A code arrives in Telegram with the exact message text from Global Constraints.
- Verify with a wrong code 4 times → `400` with "4 / 3 / 2 / 1 tries left". The 5th wrong → `410`. The right code after that → `410` (the code is gone).
- Request a fresh code, verify with the right one → `200` with `{ token, expiresAt, user }`. Verifying again with the same challenge → `410` (single use).
- Parallel-guess check: request a code, then fire 8 wrong verifies at once: `for i in $(seq 8); do curl -s -XPOST $R/verify -H 'content-type: application/json' -d "{\"challengeId\":\"$ID\",\"code\":\"000000\"}" & done; wait`. Expect at most 4 "tries left" responses; all others are `410`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/services/login-code.services.ts apps/api/src/services/auth.services.ts apps/api/src/validators/auth.validators.ts apps/api/src/controllers/auth.controllers.ts apps/api/src/routes/auth.routes.ts
git commit -m "feat(api): Telegram login codes — request and verify endpoints

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 4: Web — code login client and the two-step form

**Files:**
- Modify: `apps/web/src/lib/auth/authApi.ts` (append)
- Create: `apps/web/src/lib/auth/TelegramCodeLogin.tsx`

**Interfaces:**
- Consumes: the endpoints from Task 3; `Field` / `FieldStatus` (`components/ui/Field`), `Button`, `ArrowIcon`, `FALLBACK_MESSAGE` (`components/feedback/ErrorState`), `ApiRequestError` (`lib/api/client`, which has `.status`, `.code` and `.fields`), `authKeys` (`lib/auth/useAuth`), `useCountdown(target: Date | null): { days, hours, minutes, seconds }` (`hooks/useCountdown`).
- Produces: `requestTelegramCode(identifier: string): Promise<TelegramCodeChallenge>`, `verifyTelegramCode(challengeId: string, code: string): Promise<Session>`, and `<TelegramCodeLogin />` (no props; on success it seeds `authKeys.me()` and the guard re-renders).

- [ ] **Step 1: API calls**

In `apps/web/src/lib/auth/authApi.ts`, add `TelegramCodeChallenge` to the `@bookquest/shared` type import and append:

```ts
/** Asks the bot to send a login code to whoever the identifier resolves to. */
export const requestTelegramCode = (identifier: string): Promise<TelegramCodeChallenge> =>
  api.post<TelegramCodeChallenge>('/auth/telegram-code/request', { identifier });

/** Trades the code for a session, the same shape as every other sign-in. */
export async function verifyTelegramCode(challengeId: string, code: string): Promise<Session> {
  const session = await api.post<Session>('/auth/telegram-code/verify', { challengeId, code });
  storeToken(session);
  return session;
}
```

- [ ] **Step 2: The component**

Create `apps/web/src/lib/auth/TelegramCodeLogin.tsx`:

```tsx
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TelegramCodeChallenge } from '@bookquest/shared';
import { Field, type FieldStatus } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { ApiRequestError } from '@/lib/api/client';
import { useCountdown } from '@/hooks/useCountdown';
import { requestTelegramCode, verifyTelegramCode } from './authApi';
import { authKeys } from './useAuth';

interface FieldState {
  value: string;
  status?: FieldStatus;
  message?: string;
}

const EMPTY_FIELD: FieldState = { value: '' };
// Mirrors the server's cooldown so the button unlocks when a resend would succeed.
const RESEND_COOLDOWN_MS = 60_000;

const messageFor = (error: unknown): string =>
  error instanceof ApiRequestError ? error.message : FALLBACK_MESSAGE;

/**
 * Passwordless web login for Telegram-made accounts: identify, then type the
 * code the bot sent. Two steps in one component because they share the challenge.
 */
export function TelegramCodeLogin() {
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<TelegramCodeChallenge | null>(null);
  const [identifier, setIdentifier] = useState<FieldState>(EMPTY_FIELD);
  const [code, setCode] = useState<FieldState>(EMPTY_FIELD);
  const [codeShake, setCodeShake] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<Date | null>(null);

  const left = useCountdown(resendAt);
  const cooldown = left.minutes * 60 + left.seconds;

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      setChallenge(await requestTelegramCode(identifier.value));
      setCode(EMPTY_FIELD);
      setResendAt(new Date(Date.now() + RESEND_COOLDOWN_MS));
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.identifier) {
        setIdentifier((prev) => ({ ...prev, status: 'bad', message: error.fields.identifier }));
      } else {
        setFormError(messageFor(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function logIn(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setFormError(null);
    setBusy(true);
    try {
      const session = await verifyTelegramCode(challenge.challengeId, code.value);
      queryClient.setQueryData(authKeys.me(), session.user);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.code) {
        setCode((prev) => ({ ...prev, status: 'bad', message: error.fields.code }));
        setCodeShake((count) => count + 1);
      } else {
        // 410: expired or out of tries — clear the field; "Send a new code" is right below.
        if (error instanceof ApiRequestError && error.status === 410) setCode(EMPTY_FIELD);
        setFormError(messageFor(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setChallenge(null);
    setCode(EMPTY_FIELD);
    setFormError(null);
  }

  if (!challenge) {
    return (
      <form className="form" onSubmit={sendCode} noValidate>
        <Field
          label="Reg number, phone or @username"
          name="identifier"
          autoComplete="username"
          placeholder="#0142"
          value={identifier.value}
          status={identifier.status}
          message={identifier.message}
          onChange={(event) => setIdentifier({ value: event.target.value })}
        />
        {/* Not Field's message slot — that's invisible in the neutral state. */}
        <p className="form__note">We'll send a code to your Telegram.</p>
        <Button type="submit" className="group mt-[0.3rem]" disabled={busy}>
          <span>{busy ? 'Sending…' : 'Send code'}</span>
          <ArrowIcon />
        </Button>
        {formError && <FormError message={formError} />}
      </form>
    );
  }

  return (
    <form className="form" onSubmit={logIn} noValidate>
      <Field
        label={`Code sent to ${challenge.sentTo}`}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        autoFocus
        value={code.value}
        status={code.status}
        message={code.message}
        shakeToken={codeShake}
        onChange={(event) => setCode({ value: event.target.value.replace(/\D/g, '') })}
      />
      <Button type="submit" className="group mt-[0.3rem]" disabled={busy || code.value.length !== 6}>
        <span>{busy ? 'Checking…' : 'Log in'}</span>
        <ArrowIcon />
      </Button>
      {formError && <FormError message={formError} />}

      <div className="flex flex-wrap justify-between gap-3">
        <QuietAction onClick={() => void sendCode()} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </QuietAction>
        <QuietAction onClick={startOver}>Use something else</QuietAction>
      </div>
    </form>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="m-0 text-sm text-[#E9976A]">
      {message}
    </p>
  );
}

function QuietAction({
  onClick,
  disabled,
  children
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="type-label text-taupe transition-colors hover:text-paper-dim disabled:opacity-50 disabled:hover:text-taupe"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: exit 0. The component isn't mounted yet; Task 5 mounts it.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth/authApi.ts apps/web/src/lib/auth/TelegramCodeLogin.tsx
git commit -m "feat(web): two-step Telegram code login form

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 5: Web — HeroBanner, AuthScreen tabs, simpler PhoneAuthForm

**Files:**
- Create: `apps/web/src/components/HeroBanner.tsx`
- Modify: `apps/web/src/styles/register.css` (rename the `.auth-hero*` rules at the end of the file)
- Modify: `apps/web/src/lib/auth/AuthScreen.tsx` (full rewrite)
- Modify: `apps/web/src/lib/auth/PhoneAuthForm.tsx`

**Interfaces:**
- Consumes: `<TelegramCodeLogin />` (Task 4); `Switch<Value>({ options: readonly [opt, opt], value, onChange, 'aria-label', className? })` (`components/ui/Switch`).
- Produces: `<HeroBanner label={ReactNode} title={string} />`, used again in Task 6; `<PhoneAuthForm mode={'login' | 'signup'} />`, which no longer has `onModeChange`.

- [ ] **Step 1: Rename the hero CSS**

In `apps/web/src/styles/register.css`, rename the three selectors `.auth-hero`, `.auth-hero::after` and `.auth-hero__title` to `.hero-banner`, `.hero-banner::after` and `.hero-banner__title`. Change the section comment above them to `/* ── Hero banner — the lamp from the atmosphere, brought to the front ── */`.

- [ ] **Step 2: HeroBanner**

Create `apps/web/src/components/HeroBanner.tsx`:

```tsx
import type { ReactNode } from 'react';

interface HeroBannerProps {
  /** A plain string gets the amber label style; pass a node (e.g. `EditionMark`) to style it yourself. */
  label: ReactNode;
  title: string;
}

/** Edge-to-edge gradient header for a screen's first moment — sign-in and joining. Styles in `register.css`. */
export function HeroBanner({ label, title }: HeroBannerProps) {
  return (
    <header className="screen-bleed hero-banner">
      <div className="relative">
        {typeof label === 'string' ? <p className="type-label m-0 text-amber">{label}</p> : label}
      </div>
      {/* Keyed so the rise replays when the title swaps. */}
      <h1 key={title} className="type-display hero-banner__title">
        {title}
      </h1>
    </header>
  );
}
```

- [ ] **Step 3: PhoneAuthForm takes `mode` only**

In `apps/web/src/lib/auth/PhoneAuthForm.tsx`:
- Replace the props interface and signature with:

```tsx
interface PhoneAuthFormProps {
  mode: AuthMode;
}

/**
 * Phone number + password sign-up and sign-in. The screen around it owns which
 * mode is showing (and keys it, so switching starts from empty fields).
 */
export function PhoneAuthForm({ mode }: PhoneAuthFormProps) {
```

- Delete the whole `switchMode` function.
- Delete the trailing `<button type="button" onClick={switchMode} …>…</button>` at the end of the form.

- [ ] **Step 4: AuthScreen with tabs**

Replace `apps/web/src/lib/auth/AuthScreen.tsx` entirely:

```tsx
import { useState } from 'react';
import { Screen } from '@/components/layout/Screen';
import { HeroBanner } from '@/components/HeroBanner';
import { Switch } from '@/components/ui/Switch';
import { PhoneAuthForm } from './PhoneAuthForm';
import { TelegramCodeLogin } from './TelegramCodeLogin';

type Tab = 'new' | 'registered';

const TABS = [
  { value: 'new', label: 'New here' },
  { value: 'registered', label: "I'm registered" }
] as const;

const HERO: Record<Tab, { label: string; title: string }> = {
  new: { label: 'One book. One deadline. One quiz.', title: 'Register to win the prizes' },
  registered: { label: 'Log in to pick up where you left off.', title: 'Welcome back' }
};

/**
 * What a signed-out visitor on the open web sees on any session-only route.
 * The Mini App never lands here — `initData` has already signed its users in.
 */
export function AuthScreen() {
  const [tab, setTab] = useState<Tab>('new');
  // Password log-in is the exception for returning users; the Telegram code is the default.
  const [withPassword, setWithPassword] = useState(false);

  const selectTab = (next: Tab) => {
    setTab(next);
    setWithPassword(false);
  };

  return (
    <Screen className="gap-8">
      <HeroBanner label={HERO[tab].label} title={HERO[tab].title} />

      <div className="mx-auto grid w-full max-w-[30rem] gap-8">
        <Switch aria-label="Register or log in" options={TABS} value={tab} onChange={selectTab} />

        {tab === 'new' && <PhoneAuthForm key="signup" mode="signup" />}

        {tab === 'registered' &&
          (withPassword ? (
            <>
              <PhoneAuthForm key="login" mode="login" />
              <SwapLink onClick={() => setWithPassword(false)}>Log in with a Telegram code instead</SwapLink>
            </>
          ) : (
            <>
              <TelegramCodeLogin />
              <SwapLink onClick={() => setWithPassword(true)}>
                Signed up here with a password? Log in with password
              </SwapLink>
            </>
          ))}
      </div>
    </Screen>
  );
}

function SwapLink({ onClick, children }: { onClick: () => void; children: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="type-label justify-self-start text-taupe transition-colors hover:text-paper-dim"
    >
      {children}
    </button>
  );
}
```

- [ ] **Step 5: Fix the remaining `PhoneAuthForm` caller**

`features/registration/RegisterPage.tsx` still passes `onModeChange`. Task 6 deletes that file. To keep this task's typecheck green, remove `onModeChange={setAuthMode}` from its `<PhoneAuthForm>` and delete its `authMode` state and the `AuthMode` import.

- [ ] **Step 6: Typecheck and look**

Run: `pnpm --filter @bookquest/web typecheck` → exit 0.

Run `pnpm --filter @bookquest/web dev` and open `/me` signed out (clear `localStorage`) at 390px width:
- The "New here" tab looks like the approved sketch: hero, full name / phone / password, Register.
- "I'm registered" swaps the hero title to "Welcome back" and shows the identifier field, its note and Send code.
- The password link swaps to phone + password log-in and back.
- With a real account: send a code, the step changes to "Code sent to @xxx…", and the resend button counts down from 60s. A wrong code shakes the field with "N tries left". The right code shows the profile.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/components/HeroBanner.tsx apps/web/src/styles/register.css apps/web/src/lib/auth/AuthScreen.tsx apps/web/src/lib/auth/PhoneAuthForm.tsx apps/web/src/features/registration/RegisterPage.tsx
git commit -m "feat(web): sign-in tabs — new here / I'm registered with Telegram code

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 6: Web — `/me` is the only place to join

**Files:**
- Create: `apps/web/src/lib/api/participant.ts`
- Delete: `apps/web/src/features/profile/api/useParticipant.ts`
- Create: `apps/web/src/features/registration/JoinQuest.tsx`
- Modify: `apps/web/src/features/profile/ProfilePage.tsx`
- Modify: `apps/web/src/features/registration/api/useRegister.ts`
- Modify: `apps/web/src/features/registration/components/RegistrationForm.tsx:147`
- Modify: `apps/web/src/features/registration/SuccessScreen.tsx` (lines 31 and 71–77)
- Modify: `apps/web/src/app/router.tsx`
- Modify: `apps/web/src/layouts/AppLayout.tsx:27-32`
- Modify: `apps/web/src/features/home/components/QuestAction.tsx:80-97`
- Delete: `apps/web/src/features/registration/RegisterPage.tsx`
- Modify: `apps/web/src/styles/register.css`

**Interfaces:**
- Consumes: `<HeroBanner />` (Task 5); `useCurrentQuest()` (`lib/api/quest`, which returns `Quest` with `phase: 'upcoming' | 'reading' | 'quiz' | 'finished'` and `edition`); `<EditionMark edition />`; `<RegistrationForm />`.
- Produces: `participantKeys`, `useParticipant()` in `lib/api/participant.ts`; `<JoinQuest quest={Quest} />`; the route `/me/welcome`.

- [ ] **Step 1: Move the participant query to `lib/api`**

Create `apps/web/src/lib/api/participant.ts`:

```ts
import { useQuery } from '@tanstack/react-query';
import type { Participant } from '@bookquest/shared';
import { api } from './client';

// Shared, like `quest.ts`: the profile reads it and registration seeds it.
export const participantKeys = {
  all: ['participants'] as const,
  me: () => [...participantKeys.all, 'me'] as const
};

export function useParticipant() {
  return useQuery({
    queryKey: participantKeys.me(),
    queryFn: () => api.get<Participant>('/participants/me')
  });
}
```

Delete `apps/web/src/features/profile/api/useParticipant.ts`. In `ProfilePage.tsx`, change the import to `import { useParticipant } from '@/lib/api/participant';`.

- [ ] **Step 2: Seed the participant after registering**

In `apps/web/src/features/registration/api/useRegister.ts`, import `participantKeys` from `@/lib/api/participant` and change `onSuccess` to:

```ts
    onSuccess: (participant) => {
      // Seeded, not invalidated: the profile must show the number the moment the reveal hands back.
      queryClient.setQueryData(participantKeys.me(), participant);
      void queryClient.invalidateQueries({ queryKey: questKeys.current() });
      void queryClient.invalidateQueries({ queryKey: authKeys.me() });
    }
```

- [ ] **Step 3: JoinQuest**

Create `apps/web/src/features/registration/JoinQuest.tsx`:

```tsx
import type { Quest } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { HeroBanner } from '@/components/HeroBanner';
import { EditionMark } from './components/EditionMark';
import { RegistrationForm } from './components/RegistrationForm';

/** `/me` for a signed-in user who hasn't joined the current quest. The reveal follows at `/me/welcome`. */
export function JoinQuest({ quest }: { quest: Quest }) {
  return (
    <Screen className="gap-10">
      <HeroBanner label={<EditionMark edition={quest.edition} />} title="Register to win the prizes" />
      <div className="mx-auto w-full max-w-[30rem]">
        <RegistrationForm />
      </div>
    </Screen>
  );
}
```

- [ ] **Step 4: Route the form and the reveal to `/me`**

- `RegistrationForm.tsx:147`: `navigate('/register/success');` → `navigate('/me/welcome');`
- `SuccessScreen.tsx:31`: `<Navigate to="/" replace />` → `<Navigate to="/me" replace />`
- `SuccessScreen.tsx` button: `onClick={() => navigate('/')}` → `onClick={() => navigate('/me')}`, and `<span>Enter BookQuest</span>` → `<span>See your profile</span>`
- `SuccessScreen.tsx` comment on line 40: `/register/success` → `/me/welcome`

- [ ] **Step 5: ProfilePage — inline join and the slim profile**

In `apps/web/src/features/profile/ProfilePage.tsx`:

1. Imports: remove `Navigate` from `react-router`. Add `import { useCurrentQuest } from '@/lib/api/quest';` and `import { JoinQuest } from '@/features/registration/JoinQuest';`.

2. Replace the `404` branch:

```tsx
    // Signed in but not in this edition: join right here instead of being sent elsewhere.
    if (isNotFound(participant.error)) return <NotJoined />;
```

3. Change `ProfileHeader` to take a name and an optional number instead of a participant. Replace its props and the lines that read `participant`:

```tsx
function ProfileHeader({
  name,
  number,
  telegramUsername,
  phoneNumber,
  onSignOut
}: {
  name: string;
  number?: number;
  telegramUsername?: string | null;
  phoneNumber?: string | null;
  onSignOut: () => void;
}) {
```

   Inside it, use `{name}` for the `<h1>`, and render the reg-number row only when there is one: `{number !== undefined && <InfoRow label="Reg. Number" value={`#${number}`} />}`. Drop the now-unused `Participant` type import.

4. Pull the admin / Connect Telegram slot out of `ProfilePage` into a component both views share, and use it in `ProfilePage` in place of the inline ternary:

```tsx
/** "The one thing left to do here" — the dashboard for an admin, linking Telegram for everyone else. */
function ProfileAction() {
  const { isAdmin, user } = useAuth();
  if (isAdmin) {
    return (
      <Button to="/admin" variant="primary" className="self-start">
        Admin dashboard
      </Button>
    );
  }
  return user?.telegramUserId ? null : <ConnectTelegram />;
}
```

   Keep the existing long comment about the Mini App and `/admin`, moved above this component.

5. `ProfilePage`'s success render becomes:

```tsx
  return (
    <Screen className="gap-8">
      <ProfileHeader
        name={participant.data.fullName}
        number={participant.data.number}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
        onSignOut={signOut}
      />
      <CertificateSection />
      <ProfileAction />
    </Screen>
  );
```

   Change its first line to `const { user, signOut } = useAuth();` (`isAdmin` has moved into `ProfileAction`).

6. Add `NotJoined`:

```tsx
/**
 * Joining is only possible while the quest is `upcoming` or `reading` (the server
 * closes registration at the reading deadline); otherwise show who they are and when to come back.
 */
function NotJoined() {
  const { user, signOut } = useAuth();
  const quest = useCurrentQuest();

  if (quest.isPending) return <LoadingState label="Setting the stage…" />;

  if (quest.data && (quest.data.phase === 'upcoming' || quest.data.phase === 'reading')) {
    return <JoinQuest quest={quest.data} />;
  }

  if (quest.error && !isNotFound(quest.error)) {
    return (
      <Screen>
        <ErrorState error={quest.error} onRetry={() => quest.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen className="gap-8">
      <ProfileHeader
        name={user?.firstName ?? 'Reader'}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
        onSignOut={signOut}
      />
      <p className="max-w-sm text-taupe-dim">
        {quest.data
          ? 'Registration for this edition has closed. See you at the next one.'
          : 'The next edition opens soon.'}
      </p>
      <ProfileAction />
    </Screen>
  );
}
```

- [ ] **Step 6: Router and layout**

In `apps/web/src/app/router.tsx`:
- Remove the `RegisterPage` import. Add `Navigate` to the imports: `import { Navigate, createBrowserRouter } from 'react-router';`.
- Replace the two `/register` routes with:

```tsx
      // `/me` owns joining now; old links and bookmarks land there.
      { path: '/register', element: <Navigate to="/me" replace /> },
```

- Replace the `/me` route with:

```tsx
      {
        path: '/me',
        element: <RequireAuth />,
        children: [
          { index: true, element: <ProfilePage /> },
          { path: 'welcome', element: <SuccessScreen /> }
        ]
      },
```

In `apps/web/src/layouts/AppLayout.tsx`, replace the two `/register` lines in `isChromeless` with `pathname === '/me/welcome'`. Update the comment above it: "The number reveal is the one participant screen the design never puts a tab bar under — nothing should pull the eye off the number."

- [ ] **Step 7: Home's join button**

In `apps/web/src/features/home/components/QuestAction.tsx`:
- Delete the `if (status === 'unavailable') { … }` block (lines 80–90) and its comment.
- Change `go('/register')` to `go('/me')`.
- Remove the `TelegramLoginWidget` import. Remove `status` from the `useAuth()` destructure if nothing else in the file uses it (check with a search before removing).

- [ ] **Step 8: Delete the title page**

- `git rm apps/web/src/features/registration/RegisterPage.tsx`
- In `apps/web/src/styles/register.css`, delete:
  - the `.view--register` and `.view--register::after` rules
  - the `.titlepage` rule
  - the `/* ── The title ── */` comment and the `.titlepage__title` rule (**keep** `@keyframes title-rise`, which `.hero-banner__title` uses)
  - the `.lede` rule
  - the whole `/* Desktop: the page splits … */` `@media (min-width: 880px)` block, including `.titlepage .form`
- Keep `.edition`, `.edition__mark`, `.form`, `.form__note`, everything under `.success`, and `.hero-banner*`.
- Update the file's header comment: it now holds the join form, the number reveal and the hero banner. Drop the title-page wording.

Check: `grep -rn "titlepage\|view--register\|lede\|RegisterPage\|/register" apps/web/src` should print only the `/register` redirect in `router.tsx` and the `register.css` import in `styles/index.css`.

- [ ] **Step 9: Typecheck and walk the flows**

Run: `pnpm --filter @bookquest/web typecheck` → exit 0.

Run the web app against the dev API:
- Web, signed in with an account that hasn't joined, quest in `reading`: `/me` shows the hero with the edition mark and the join form, with the tab bar visible. Submitting goes to `/me/welcome` with no tab bar, and the number animates in. **See your profile** shows the profile with that number straight away, with no flash of the join form (Review Focus 4).
- Visit `/me/welcome` directly after that → redirects to `/me`. Signed out → `AuthScreen` (Review Focus 5).
- `/register` → lands on `/me`.
- Home's **Join BookQuest** → `/me`, both signed out (tabs) and signed in (join form).
- No current quest (`window.mockApi` isn't available against the real API, so run `db.quests.updateMany({}, {$set:{isCurrent:false}})` in mongosh and restore it afterwards): `/me` shows the slim profile with "The next edition opens soon."
- Mini App (through the ngrok tunnel in Telegram): open fresh → **You** → join form → reveal → profile. Close and reopen → **You** shows the profile with no sign-in.

- [ ] **Step 10: Commit**

```bash
git add apps/web/src/lib/api/participant.ts apps/web/src/features/profile apps/web/src/features/registration apps/web/src/app/router.tsx apps/web/src/layouts/AppLayout.tsx apps/web/src/features/home/components/QuestAction.tsx apps/web/src/styles/register.css
git commit -m "feat(web): /me is the one place to join — inline form, reveal at /me/welcome

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>"
```

---

### Task 7: End-to-end pass

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `pnpm --filter @bookquest/shared build && pnpm --filter @bookquest/api typecheck && pnpm --filter @bookquest/web typecheck`
Expected: all exit 0.

- [ ] **Step 2: Walk the spec's verification list**

Against the dev API and bot, check off each item:
- web sign-up
- code log-in by reg number, by phone and by @username, with a real code delivered to Telegram
- a wrong code, running out of tries, and an expired code (set `expiresAt` in the past with mongosh: `db.logincodes.updateOne({}, {$set:{expiresAt:new Date(0)}})`)
- the resend cooldown
- a password account with no Telegram gives the "isn't connected to Telegram" message
- password log-in
- `/me` → `/me/welcome` → profile
- the no-quest state
- the `/register` redirect

Screenshots at 390px and 1280px of: "New here", "I'm registered" step 1 and step 2, the join form on `/me`, and the slim profile.

- [ ] **Step 3: Report**

List anything that failed or behaved differently from the spec, with the observed output. There is no commit for this task.
