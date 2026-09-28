# Email/Password Auth Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email + password as a second, independent way to get a BookQuest session, alongside the existing Telegram sign-in, with a way for an email/password user to link a Telegram identity to their account later.

**Architecture:** Both auth methods converge on one `issueSession(user)` call that mints the JWT and builds the response, exactly the way `authenticateWithTelegram` and `authenticateWithTelegramWidget` already converge on `issueSessionForProfile`. Email/password is added at the same layer (services → controllers → routes) without touching either existing Telegram route.

**Tech Stack:** Express, Mongoose, Zod, `jose` (existing JWT lib), `bcrypt` (new), React, TanStack Query.

**Spec:** `docs/superpowers/specs/2026-09-28-email-password-auth-design.md`

**Note on testing:** This project has no test runner configured anywhere (no vitest/jest, `apps/api/package.json` has no `test` script) and the project's own conventions say not to add one. Every task below replaces the usual "write a failing test" cycle with a concrete manual verification step — a `curl` command against the running dev server, or a browser check — with the exact expected output written out. Run these for real before checking a step off; "should work" is not a substitute for seeing the response.

## Global Constraints

- Do not modify `/auth/telegram` or `/auth/telegram-widget` behavior — only reuse pieces of it.
- No email verification, no password reset — out of scope for this plan.
- Password: min 8, max 72 characters (72 is bcrypt's input ceiling; longer is silently truncated by bcrypt itself, so reject before that).
- Login failure (unknown email OR wrong password) returns the identical message `"Incorrect email or password."` — never reveal which one was wrong.
- `passwordHash` must never appear in an API response — schema field is `select: false`.
- `email` and `telegramUserId` are both optional, unique via a partial index (`$type: 'string'`, not `sparse`) on `User` — see Task 2's correction note.
- `/auth/register` and `/auth/login` are unauthenticated and sit behind `authRateLimit` (same tier as `/auth/telegram`). `/auth/telegram/link` requires a session (`requireUser`) and also sits behind `authRateLimit`.
- bcrypt cost factor: 12.
- Email is always stored and compared lowercased/trimmed.

## Review Focus

- Duplicate email on register → `409 conflict`, not a 500 from a raw Mongo duplicate-key error and not a silent overwrite.
- Email case: `"Jane@X.com"` at register and `"jane@x.com"` at login must resolve to the same account.
- Unknown email vs. correct email/wrong password at login → identical response (status, code, message) — no user enumeration.
- Linking a Telegram id already attached to a *different* user → `409 conflict`, not a silent reassignment or an unhandled duplicate-key crash.
- A user with no `passwordHash` (shouldn't normally reach `authenticateWithEmail`, but guard it) never causes `bcrypt.compare` to throw against `null` — treated as the same generic login failure, not a 500.

---

## File Structure

**Backend:**
- Modify `packages/shared/src/schemas/auth.ts` — add `emailRegisterSchema`, `emailLoginSchema`
- Modify `packages/shared/src/schemas/user.ts` — `sessionUserSchema.telegramUserId` nullable, add `email`
- Modify `apps/api/src/models/user.model.ts` — `telegramUserId` optional+partial-unique, add `email`, `passwordHash`
- Modify `apps/api/src/db/connect.ts` — `UserModel.syncIndexes()` on boot (Task 2 correction)
- Modify `apps/api/src/services/user.services.ts` — add `createUserWithEmail`, `findUserByEmail`, `linkTelegramToUser`
- Modify `apps/api/src/services/auth.services.ts` — split `issueSessionForProfile` into `issueSession` + Telegram upsert call; add `registerWithEmail`, `authenticateWithEmail`, `linkTelegram`
- Modify `apps/api/src/validators/auth.validators.ts` — add `emailRegisterBody`, `emailLoginBody`
- Modify `apps/api/src/controllers/auth.controllers.ts` — add `registerWithEmail`, `signInWithEmail`, `linkTelegramAccount`
- Modify `apps/api/src/routes/auth.routes.ts` — wire the three new routes
- Modify `apps/api/package.json` — add `bcrypt`, `@types/bcrypt`

**Frontend:**
- Modify `apps/web/src/lib/auth/authApi.ts` — add `registerWithEmail`, `loginWithEmail`, `linkTelegram`
- Create `apps/web/src/lib/auth/EmailAuthForm.tsx`
- Modify `apps/web/src/features/registration/RegisterPage.tsx` — render `EmailAuthForm` in `NoSessionNote`
- Modify `apps/web/src/features/profile/ProfilePage.tsx` — add a "Connect Telegram" section for a session user with no `telegramUserId`

---

### Task 1: Shared schemas

**Files:**
- Modify: `packages/shared/src/schemas/auth.ts`
- Modify: `packages/shared/src/schemas/user.ts`

**Interfaces:**
- Produces: `emailRegisterSchema` (and inferred type `EmailRegisterPayload`), `emailLoginSchema` (`EmailLoginPayload`), both exported from `@bookquest/shared`
- Produces: `sessionUserSchema` now has `telegramUserId: string | null` and `email: string | null`

- [ ] **Step 1: Add the two email auth schemas**

In `packages/shared/src/schemas/auth.ts`, after the existing `telegramWidgetAuthSchema` block:

```typescript
/**
 * Email + password sign-up. 72 is bcrypt's own input ceiling — anything
 * longer is silently truncated by bcrypt itself, so this rejects before
 * that point rather than hash a password the user didn't actually type.
 */
export const emailRegisterSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(8, 'Use at least 8 characters.').max(72, 'Use at most 72 characters.'),
  firstName: z.string().trim().min(1, 'Enter your name.')
});

export type EmailRegisterPayload = z.infer<typeof emailRegisterSchema>;

export const emailLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter your password.')
});

export type EmailLoginPayload = z.infer<typeof emailLoginSchema>;
```

- [ ] **Step 2: Update `sessionUserSchema`**

In `packages/shared/src/schemas/user.ts`, change:

```typescript
export const sessionUserSchema = z.object({
  id: z.string(),
  telegramUserId: z.string(),
  firstName: z.string(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  role: z.enum(ROLES),
  participant: participantSchema.nullable()
});
```

to:

```typescript
export const sessionUserSchema = z.object({
  id: z.string(),
  telegramUserId: z.string().nullable(),
  email: z.string().nullable(),
  firstName: z.string(),
  username: z.string().nullable(),
  photoUrl: z.string().nullable(),
  role: z.enum(ROLES),
  participant: participantSchema.nullable()
});
```

- [ ] **Step 3: Build the shared package and verify**

Run: `pnpm --filter @bookquest/shared build`
Expected: exits 0, `packages/shared/dist/schemas/auth.js` and `auth.d.ts` now contain `emailRegisterSchema`/`emailLoginSchema`.

Then run: `pnpm --filter @bookquest/shared typecheck`
Expected: exits 0, no errors.

- [ ] **Step 4: Commit**

```bash
git add packages/shared/src/schemas/auth.ts packages/shared/src/schemas/user.ts
git commit -m "feat(shared): add email auth schemas, make sessionUser telegramUserId nullable"
```

---

### Task 2: User model — optional Telegram id, add email + password fields

**Files:**
- Modify: `apps/api/src/models/user.model.ts`

**Interfaces:**
- Consumes: nothing new
- Produces: `UserAttributes`/`UserDocument` now include `telegramUserId: string | null`, `email: string | null`, `passwordHash: string | null` (the last excluded from default query projections)

- [ ] **Step 1: Update the schema**

Replace the `userSchema` definition in `apps/api/src/models/user.model.ts`:

```typescript
const userSchema = new Schema(
  {
    /* Stored as a string. Telegram ids can exceed 2^53, and a number that
       silently loses its last digit would match the wrong account. Optional:
       an email/password account has no Telegram id until it's linked. */
    telegramUserId: { type: String },

    /* Optional: a Telegram-only account never sets these. Lowercased and
       trimmed on write so "Jane@X.com" and "jane@x.com" are one account. */
    email: { type: String, lowercase: true, trim: true },
    /* Excluded from default query results — nothing should ever have to
       remember not to serialize this. */
    passwordHash: { type: String, select: false },

    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, default: null },
    /** The @handle. Can change; never used to identify anyone. */
    username: { type: String, default: null },
    photoUrl: { type: String, default: null },
    languageCode: { type: String, default: null },

    /* Resolved from ADMIN_TELEGRAM_IDS at login and re-read from here on every
       admin request. There is no endpoint that writes it. */
    role: { type: String, enum: ROLES, default: 'participant' },

    lastSeenAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// Partial, not sparse: a sparse index only excludes a *missing* field — it
// still indexes an explicit `null`, so two users with no telegramUserId (or
// no email) would collide on that shared `null`. A partial filter excludes
// anything that isn't actually a string, `null` included.
userSchema.index(
  { telegramUserId: 1 },
  { unique: true, partialFilterExpression: { telegramUserId: { $type: 'string' } }, name: 'telegramUserId_unique_partial' }
);
userSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } }, name: 'email_unique_partial' }
);
```

Remove the old inline `unique: true` from the `telegramUserId` field (now handled by the explicit index above, since it's no longer `required`).

**Correction (found in final review, not caught during planning):** the original version of this step used `sparse: true` instead of a partial filter, and kept `default: null` on all three fields above. That combination breaks after the *first* user with no `telegramUserId` (or no `email`) — a sparse index still indexes an explicit `null`, so the second such user collides on the unique constraint. It also means any database that already has the old (pre-this-feature) non-sparse `telegramUserId` index needs it replaced, not augmented — MongoDB won't silently swap an index's options under the same auto-generated name, and Mongoose's default index build reports that as an event, not a thrown error, so a stale index fails silently. The corrected version above uses `partialFilterExpression` and drops `default: null`; a corresponding `UserModel.syncIndexes()` call was added to `connectToDatabase` (`apps/api/src/db/connect.ts`) so any existing database self-heals on the next boot instead of needing a one-off migration.

- [ ] **Step 2: Rebuild and typecheck the API**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exits 0. (Existing call sites that read `user.telegramUserId` as a plain string, e.g. `toSessionUser` in `auth.services.ts`, will now show as `string | null` mismatches against the still-non-nullable `SessionUser.telegramUserId` field from before Task 1 — Task 1 already made that field nullable, so this should be clean. If it isn't, that's the signal Task 1 wasn't picked up; re-run `pnpm --filter @bookquest/shared build` first.)

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/models/user.model.ts
git commit -m "feat(api): make telegramUserId optional, add email + passwordHash to User"
```

---

### Task 3: `bcrypt` + user service functions

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/src/services/user.services.ts`

**Interfaces:**
- Consumes: `UserModel` from Task 2, `ApiError` from `apps/api/src/utils/api-error.ts`
- Produces:
  - `createUserWithEmail(email: string, password: string, firstName: string): Promise<UserDocument>`
  - `findUserByEmail(email: string): Promise<UserDocument | null>` (includes `passwordHash`)
  - `linkTelegramToUser(user: UserDocument, profile: TelegramProfile): Promise<UserDocument>`

- [ ] **Step 1: Install bcrypt**

Run: `pnpm --filter @bookquest/api add bcrypt && pnpm --filter @bookquest/api add -D @types/bcrypt`
Expected: both land in `apps/api/package.json` (`bcrypt` under `dependencies`, `@types/bcrypt` under `devDependencies`).

- [ ] **Step 2: Add the three functions**

In `apps/api/src/services/user.services.ts`, add the import and the functions:

```typescript
import bcrypt from 'bcrypt';
import { ApiError } from '../utils/api-error.js';

const BCRYPT_COST = 12;

/** POST /auth/register. Throws 409 if the email is already in use. */
export async function createUserWithEmail(
  email: string,
  password: string,
  firstName: string
): Promise<UserDocument> {
  const existing = await UserModel.findOne({ email });
  if (existing) {
    throw ApiError.conflict('That email is already in use.');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  return UserModel.create({
    email,
    passwordHash,
    firstName,
    role: 'participant'
  });
}

/**
 * For login. Explicit `+passwordHash` — the schema excludes it by default
 * (see Task 2), so a normal query would return `undefined` and every
 * `bcrypt.compare` would fail even with the right password.
 */
export function findUserByEmail(email: string): Promise<UserDocument | null> {
  return UserModel.findOne({ email }).select('+passwordHash');
}

/**
 * Attaches a Telegram identity to an already-authenticated user. Throws 409
 * if that Telegram id is already claimed by a *different* account — this is
 * an attach, never a merge.
 */
export async function linkTelegramToUser(
  user: UserDocument,
  profile: TelegramProfile
): Promise<UserDocument> {
  const claimedBy = await UserModel.findOne({ telegramUserId: profile.telegramUserId });
  if (claimedBy && claimedBy.id !== user.id) {
    throw ApiError.conflict('That Telegram account is already connected to a different user.');
  }

  user.telegramUserId = profile.telegramUserId;
  user.username = profile.username;
  user.photoUrl = profile.photoUrl;
  user.languageCode = profile.languageCode;
  await user.save();
  return user;
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/services/user.services.ts
git commit -m "feat(api): add createUserWithEmail, findUserByEmail, linkTelegramToUser"
```

---

### Task 4: Auth service — `issueSession` split, register/login/link

**Files:**
- Modify: `apps/api/src/services/auth.services.ts`

**Interfaces:**
- Consumes: `createUserWithEmail`, `findUserByEmail`, `linkTelegramToUser` (Task 3), `EmailRegisterPayload`, `EmailLoginPayload` (Task 1)
- Produces:
  - `registerWithEmail(payload: EmailRegisterPayload): Promise<Session>`
  - `authenticateWithEmail(payload: EmailLoginPayload): Promise<Session>`
  - `linkTelegram(user: UserDocument, payload: TelegramWidgetAuthPayload): Promise<SessionUser>`
  - `issueSession(user: UserDocument): Promise<Session>` (replaces `issueSessionForProfile`)

- [ ] **Step 1: Split `issueSessionForProfile` into `issueSession`**

Replace:

```typescript
async function issueSessionForProfile(profile: TelegramProfile): Promise<Session> {
  const user = await upsertUserFromTelegramProfile(profile);
  const { token, expiresAt } = await signSessionToken(user.id);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: await toSessionUser(user)
  };
}
```

with:

```typescript
/**
 * The point every sign-in path converges on, whoever proved who is asking —
 * Telegram's initData, the Login Widget, or an email/password match. From
 * here on there is exactly one answer to "what does signing in mean": mint a
 * token, return the session.
 */
async function issueSession(user: UserDocument): Promise<Session> {
  const { token, expiresAt } = await signSessionToken(user.id);

  return {
    token,
    expiresAt: expiresAt.toISOString(),
    user: await toSessionUser(user)
  };
}
```

- [ ] **Step 2: Update the two Telegram call sites**

Change:

```typescript
export async function authenticateWithTelegram(initData: string): Promise<Session> {
  const verified = verifyInitData(initData);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram initData');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  return issueSessionForProfile(verified.profile);
}
```

to:

```typescript
export async function authenticateWithTelegram(initData: string): Promise<Session> {
  const verified = verifyInitData(initData);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram initData');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  const user = await upsertUserFromTelegramProfile(verified.profile);
  return issueSession(user);
}
```

and the same substitution (`issueSessionForProfile(verified.profile)` → `upsertUserFromTelegramProfile` + `issueSession(user)`) in `authenticateWithTelegramWidget`.

- [ ] **Step 3: Add the email and link functions**

```typescript
import { createUserWithEmail, findUserByEmail, linkTelegramToUser } from './user.services.js';
import bcrypt from 'bcrypt';
import type { EmailLoginPayload, EmailRegisterPayload } from '@bookquest/shared';

const INCORRECT_CREDENTIALS = 'Incorrect email or password.';

/** POST /auth/register */
export async function registerWithEmail(payload: EmailRegisterPayload): Promise<Session> {
  const user = await createUserWithEmail(payload.email, payload.password, payload.firstName);
  return issueSession(user);
}

/**
 * POST /auth/login. The message is identical whether the email doesn't
 * exist or the password is wrong — a different message either way would let
 * a caller enumerate which emails have accounts.
 */
export async function authenticateWithEmail(payload: EmailLoginPayload): Promise<Session> {
  const user = await findUserByEmail(payload.email);

  if (!user || !user.passwordHash) {
    throw ApiError.unauthorized(INCORRECT_CREDENTIALS);
  }

  const matches = await bcrypt.compare(payload.password, user.passwordHash);
  if (!matches) {
    throw ApiError.unauthorized(INCORRECT_CREDENTIALS);
  }

  return issueSession(user);
}

/**
 * POST /auth/telegram/link. Unlike the other three, this doesn't issue a new
 * session — the caller is already signed in — it just returns the updated
 * `SessionUser` so the client can refresh its cache.
 */
export async function linkTelegram(
  user: UserDocument,
  payload: TelegramWidgetAuthPayload
): Promise<SessionUser> {
  const verified = verifyLoginWidget(payload);

  if (!verified.ok) {
    logger.warn({ reason: verified.reason }, 'Rejected Telegram widget sign-in');
    throw ApiError.unauthorized('That Telegram sign-in could not be verified.');
  }

  const linked = await linkTelegramToUser(user, verified.profile);
  return toSessionUser(linked);
}
```

`toSessionUser` needs one addition — it doesn't currently return `email`:

```typescript
export async function toSessionUser(user: UserDocument): Promise<SessionUser> {
  return {
    id: user.id,
    telegramUserId: user.telegramUserId,
    email: user.email,
    firstName: user.firstName,
    username: user.username ?? null,
    photoUrl: user.photoUrl ?? null,
    role: user.role,
    participant: await findParticipantForUser(user)
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/services/auth.services.ts
git commit -m "feat(api): add registerWithEmail, authenticateWithEmail, linkTelegram"
```

---

### Task 5: Validators, controllers, routes — and the first end-to-end check

**Files:**
- Modify: `apps/api/src/validators/auth.validators.ts`
- Modify: `apps/api/src/controllers/auth.controllers.ts`
- Modify: `apps/api/src/routes/auth.routes.ts`

**Interfaces:**
- Consumes: `registerWithEmail`, `authenticateWithEmail`, `linkTelegram` (Task 4); `emailRegisterSchema`, `emailLoginSchema`, `telegramWidgetAuthSchema` (Task 1); `requireUser`, `currentUser` (existing `auth.middleware.ts`)
- Produces: `POST /api/v1/auth/register`, `POST /api/v1/auth/login`, `POST /api/v1/auth/telegram/link`

- [ ] **Step 1: Validators**

In `apps/api/src/validators/auth.validators.ts`:

```typescript
import {
  telegramAuthSchema,
  telegramWidgetAuthSchema,
  emailRegisterSchema,
  emailLoginSchema
} from '@bookquest/shared';

/** Request-shaped wrapper around the shared rule. */
export const telegramAuthBody = telegramAuthSchema;
export const telegramWidgetAuthBody = telegramWidgetAuthSchema;
export const emailRegisterBody = emailRegisterSchema;
export const emailLoginBody = emailLoginSchema;
```

- [ ] **Step 2: Controllers**

In `apps/api/src/controllers/auth.controllers.ts`, add:

```typescript
import type { EmailLoginPayload, EmailRegisterPayload } from '@bookquest/shared';

/** POST /api/v1/auth/register */
export async function registerWithEmail(req: Request, res: Response): Promise<void> {
  ok(res, await authService.registerWithEmail(req.body as EmailRegisterPayload));
}

/** POST /api/v1/auth/login */
export async function signInWithEmail(req: Request, res: Response): Promise<void> {
  ok(res, await authService.authenticateWithEmail(req.body as EmailLoginPayload));
}

/** POST /api/v1/auth/telegram/link */
export async function linkTelegramAccount(req: Request, res: Response): Promise<void> {
  ok(res, await authService.linkTelegram(currentUser(req), req.body as TelegramWidgetAuthPayload));
}
```

- [ ] **Step 3: Routes**

In `apps/api/src/routes/auth.routes.ts`, add after the existing `/telegram-widget` route:

```typescript
authRoutes.post(
  '/register',
  authRateLimit,
  validate(emailRegisterBody),
  authController.registerWithEmail
);

authRoutes.post('/login', authRateLimit, validate(emailLoginBody), authController.signInWithEmail);

authRoutes.post(
  '/telegram/link',
  requireUser,
  authRateLimit,
  validate(telegramWidgetAuthBody),
  authController.linkTelegramAccount
);
```

- [ ] **Step 4: Typecheck**

Run: `pnpm --filter @bookquest/api typecheck`
Expected: exits 0.

- [ ] **Step 5: Manual end-to-end verification**

Start Mongo and the API (in separate terminals, or however you normally run this repo):

```bash
pnpm --filter @bookquest/api dev
```

Register:

```bash
curl -s -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"correcthorse","firstName":"Jane"}' | python3 -m json.tool
```
Expected: `200`, a `data.token`, and `data.user.email` = `"jane@example.com"`, `data.user.telegramUserId` = `null`.

Duplicate register (Review Focus item 1):
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/api/v1/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"anotherpass","firstName":"Jane"}'
```
Expected: `409`.

Email case-insensitivity (Review Focus item 2) — log in with different casing:
```bash
curl -s -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"Jane@Example.com","password":"correcthorse"}' | python3 -m json.tool
```
Expected: `200`, a token — same account.

Wrong password vs. unknown email (Review Focus item 3) — compare both:
```bash
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"jane@example.com","password":"wrong"}'
curl -s -o /dev/null -w '%{http_code} %{size_download}\n' -X POST http://localhost:4000/api/v1/auth/login \
  -H 'Content-Type: application/json' -d '{"email":"nobody@example.com","password":"whatever"}'
```
Expected: both `401`, and identical response body size (fetch both without `-o /dev/null` if sizes differ and confirm the message text is exactly the same).

`/telegram/link` without a session:
```bash
curl -s -o /dev/null -w '%{http_code}\n' -X POST http://localhost:4000/api/v1/auth/telegram/link \
  -H 'Content-Type: application/json' -d '{}'
```
Expected: `401`.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/validators/auth.validators.ts apps/api/src/controllers/auth.controllers.ts apps/api/src/routes/auth.routes.ts
git commit -m "feat(api): wire register/login/telegram-link routes"
```

---

### Task 6: Frontend `authApi` additions

**Files:**
- Modify: `apps/web/src/lib/auth/authApi.ts`

**Interfaces:**
- Consumes: `api` (existing client), `storeToken` (existing), `EmailRegisterPayload`/`EmailLoginPayload`/`TelegramWidgetAuthPayload`/`Session`/`SessionUser` from `@bookquest/shared`
- Produces: `registerWithEmail(payload): Promise<Session>`, `loginWithEmail(payload): Promise<Session>`, `linkTelegram(payload): Promise<SessionUser>`

- [ ] **Step 1: Add the three functions**

In `apps/web/src/lib/auth/authApi.ts`, add:

```typescript
import type { EmailLoginPayload, EmailRegisterPayload } from '@bookquest/shared';

/** The standalone web app's email sign-up. */
export async function registerWithEmail(payload: EmailRegisterPayload): Promise<Session> {
  const session = await api.post<Session>('/auth/register', payload);
  storeToken(session);
  return session;
}

/** The standalone web app's email sign-in. */
export async function loginWithEmail(payload: EmailLoginPayload): Promise<Session> {
  const session = await api.post<Session>('/auth/login', payload);
  storeToken(session);
  return session;
}

/**
 * Attaches a Telegram identity to the current session. No `storeToken` —
 * unlike the other sign-in calls, this doesn't issue a new session, it just
 * returns the updated `SessionUser` for the caller to write into the cache.
 */
export async function linkTelegram(payload: TelegramWidgetAuthPayload): Promise<SessionUser> {
  return api.post<SessionUser>('/auth/telegram/link', payload);
}
```

- [ ] **Step 2: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/auth/authApi.ts
git commit -m "feat(web): add registerWithEmail, loginWithEmail, linkTelegram to authApi"
```

---

### Task 7: `EmailAuthForm` component

**Files:**
- Create: `apps/web/src/lib/auth/EmailAuthForm.tsx`

**Interfaces:**
- Consumes: `registerWithEmail`, `loginWithEmail` (Task 6), `authKeys` (from `./useAuth`), existing `Button` component (`@/components/ui/Button`)
- Produces: `<EmailAuthForm />` — no props

- [ ] **Step 1: Check the existing `Button` and input styling conventions**

Look at `apps/web/src/features/registration/components/RegistrationForm.tsx` for how this codebase styles a text input and lays out a form — match that, don't invent new input styling. (Read the file; there is no code to paste here since the exact classes depend on what's there.)

- [ ] **Step 2: Write the component**

```typescript
import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/Button';
import { authKeys } from './useAuth';
import { loginWithEmail, registerWithEmail } from './authApi';

type Mode = 'login' | 'signup';
type Status = 'idle' | 'busy' | 'error';

/**
 * The open web's second sign-in option, next to `TelegramLoginWidget` — for
 * anyone who doesn't want to wait on this app's Telegram domain being set up.
 */
export function EmailAuthForm() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setStatus('busy');
    setError(null);

    const action =
      mode === 'login'
        ? loginWithEmail({ email, password })
        : registerWithEmail({ email, password, firstName });

    void action
      .then((session) => {
        queryClient.setQueryData(authKeys.me(), session.user);
      })
      .catch((err: unknown) => {
        setStatus('error');
        setError(err instanceof Error ? err.message : 'Something went wrong. Try again.');
      });
  };

  return (
    <form onSubmit={submit} className="grid gap-3">
      {mode === 'signup' && (
        <input
          type="text"
          placeholder="Your name"
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          required
          className="rounded border border-[var(--rule)] bg-transparent px-3 py-2 text-paper"
        />
      )}
      <input
        type="email"
        placeholder="Email"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
        required
        className="rounded border border-[var(--rule)] bg-transparent px-3 py-2 text-paper"
      />
      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        required
        minLength={8}
        className="rounded border border-[var(--rule)] bg-transparent px-3 py-2 text-paper"
      />
      {error && <p className="text-sm text-ember">{error}</p>}
      <Button type="submit" disabled={status === 'busy'}>
        {status === 'busy' ? 'Working…' : mode === 'login' ? 'Log in' : 'Sign up'}
      </Button>
      <button
        type="button"
        onClick={() => setMode(mode === 'login' ? 'signup' : 'login')}
        className="type-label text-taupe hover:text-paper-dim"
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </form>
  );
}
```

(If `RegistrationForm.tsx`'s input styling from Step 1 differs from the classes above, use its actual classes instead — the goal is visual consistency with the rest of the app, not this exact string.)

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: exits 0.

- [ ] **Step 4: Commit**

```bash
git add apps/web/src/lib/auth/EmailAuthForm.tsx
git commit -m "feat(web): add EmailAuthForm"
```

---

### Task 8: Wire `EmailAuthForm` into `RegisterPage`

**Files:**
- Modify: `apps/web/src/features/registration/RegisterPage.tsx`

**Interfaces:**
- Consumes: `EmailAuthForm` (Task 7)

- [ ] **Step 1: Add it next to the Telegram widget**

In `RegisterPage.tsx`, import `EmailAuthForm` and render it in the `unavailable` branch of `NoSessionNote`, next to `<TelegramLoginWidget />`:

```typescript
import { EmailAuthForm } from '@/lib/auth/EmailAuthForm';
```

Change the final block of `NoSessionNote` from:

```typescript
  return (
    <div className="grid gap-3">
      <p className="type-label text-amber">Sign in with Telegram</p>
      <p className="max-w-[30rem] text-paper-dim">
        BookQuest uses your Telegram account to identify you — that&rsquo;s how the quiz and
        certificate find you.
      </p>
      <TelegramLoginWidget />
    </div>
  );
```

to:

```typescript
  return (
    <div className="grid gap-6">
      <div className="grid gap-3">
        <p className="type-label text-amber">Sign in with Telegram</p>
        <p className="max-w-[30rem] text-paper-dim">
          Fastest way in — Telegram is also how the quiz and certificate find you.
        </p>
        <TelegramLoginWidget />
      </div>
      <div className="grid gap-3">
        <p className="type-label text-amber">Or use email</p>
        <EmailAuthForm />
      </div>
    </div>
  );
```

- [ ] **Step 2: Manual browser verification**

Run `pnpm dev` (or the project's usual dev command), open the web app outside Telegram (plain browser), navigate to `/register`.
Expected: both "Sign in with Telegram" and "Or use email" sections render. Sign up with a new email — expected: redirected into the registration form the same way a Telegram sign-in would (since `status` becomes `'authenticated'`). Reload the page — expected: still signed in (token persisted).

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/features/registration/RegisterPage.tsx
git commit -m "feat(web): offer email sign-in alongside Telegram on the register page"
```

---

### Task 9: "Connect Telegram" on the profile page

**Files:**
- Modify: `apps/web/src/features/profile/ProfilePage.tsx`

**Interfaces:**
- Consumes: `linkTelegram` (Task 6), `useAuth` (existing), same `window.onTelegramAuth` bridge pattern as `TelegramLoginWidget.tsx`

- [ ] **Step 1: Add the section**

In `ProfilePage.tsx`, import `useAuth`'s user and add a new section that only renders for a signed-in user with no `telegramUserId` yet. Add near the bottom of the returned `<Screen>`, after `CertificateSection`:

```typescript
import { ConnectTelegram } from './components/ConnectTelegram';
```

```typescript
      {!user?.telegramUserId && <ConnectTelegram />}
```

(`ProfilePage` needs `user` from `useAuth()` in scope — it currently only destructures `isAdmin`; change `const { isAdmin } = useAuth();` to `const { isAdmin, user } = useAuth();`. `useAuth()`'s `user` is typed `SessionUser | null` — `RequireAuth` in `guards.tsx` checks `status`, it doesn't narrow this type across the route tree — so this reads `user?.telegramUserId`, the same optional-chaining pattern `RegisterPage.tsx` already uses for `user?.participant`, rather than asserting non-null.)

- [ ] **Step 2: Write the component**

Create `apps/web/src/features/profile/components/ConnectTelegram.tsx`, following `TelegramLoginWidget.tsx`'s exact bridge pattern but calling `linkTelegram` and merging into the cached user instead of seeding a fresh session:

```typescript
import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';
import { authKeys } from '@/lib/auth/useAuth';
import { linkTelegram } from '@/lib/auth/authApi';

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

type State = 'idle' | 'linking' | 'error' | 'script-failed';

/**
 * The deferred half of email/password sign-up: once the app's Telegram
 * domain is registered with @BotFather, an email/password user can attach
 * their Telegram identity here without creating a second account.
 */
export function ConnectTelegram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>('idle');

  useEffect(() => {
    if (!BOT_USERNAME) {
      setState('script-failed');
      return;
    }

    window.onTelegramAuth = (payload: TelegramWidgetAuthPayload) => {
      setState('linking');
      void linkTelegram(payload)
        .then((user) => {
          queryClient.setQueryData(authKeys.me(), user);
        })
        .catch(() => setState('error'));
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    script.onerror = () => setState('script-failed');

    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      containerRef.current?.replaceChildren();
    };
  }, [queryClient]);

  if (state === 'script-failed') return null;

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label">Connect Telegram</p>
      <p className="max-w-sm text-taupe-dim">
        Link your Telegram account for a faster sign-in next time.
      </p>
      <div ref={containerRef} />
      {state === 'linking' && <p className="text-sm text-paper-dim">Connecting…</p>}
      {state === 'error' && (
        <p className="text-sm text-ember">Telegram confirmed you, but connecting failed. Try again.</p>
      )}
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `pnpm --filter @bookquest/web typecheck`
Expected: exits 0.

- [ ] **Step 4: Manual verification**

With the Telegram domain registered to whatever tunnel you're testing against (see the earlier `/setdomain` discussion — this step is a no-op until that's set), sign up with email on `/register`, register for the current quest so `/me` renders, then open `/me` and confirm the "Connect Telegram" section appears and clicking through the widget links the account (`GET /auth/me` afterward shows a non-null `telegramUserId`).

If the domain isn't registered yet, at minimum confirm: the section renders for an email-only user and does *not* render once `telegramUserId` is set (e.g. for a user who signed up via Telegram originally).

- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features/profile/ProfilePage.tsx apps/web/src/features/profile/components/ConnectTelegram.tsx
git commit -m "feat(web): let a signed-in user connect their Telegram account"
```
