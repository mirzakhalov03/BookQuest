# Email/password auth (design)

## Why

BookQuest's only sign-in today is Telegram (`initData` inside the Mini App, the
Login Widget on the standalone web app). The Login Widget requires a domain
registered with @BotFather, and only one domain can be registered at a time —
which makes local dev and production fight over the same bot, and blocks
anyone from using the web app until that domain is sorted out.

This adds email + password as a second, fully independent way to get a
session. Telegram stays exactly as it is — nothing here changes `/auth/telegram`
or `/auth/telegram-widget` — and a logged-in email/password user can connect a
Telegram identity to their account later, whenever its domain is ready.

Out of scope: email verification, forgot-password/reset. Both need a
transactional email provider this project doesn't have yet. A locked-out
password account is a manual fix for now.

## Data model

`apps/api/src/models/user.model.ts` — a `User` currently *must* have a
`telegramUserId`. That stops being true:

- `telegramUserId`: `required: true, unique: true` → `required: false`, no
  `default`, unique index with `partialFilterExpression: { telegramUserId: {
  $type: 'string' } }`. **Not `sparse`** — a sparse index only excludes a
  *missing* field, and still indexes an explicit `null`, so a `default: null`
  field would let the first two users with no Telegram id collide on that
  shared `null`. A partial filter excludes anything that isn't actually a
  string, `null` included.
- `email`: new, `String` (no `default`), lowercased/trimmed, same
  partial-unique-index treatment as `telegramUserId`.
- `passwordHash`: new, `String, select: false` (no `default`) — excluded from
  normal queries so it never accidentally serializes into a response.
- Any database that already has the old (non-partial) `telegramUserId` index
  needs it replaced, not just augmented — MongoDB won't silently swap an
  index's options under the same auto-generated name, and Mongoose's default
  background index build reports that as an event, not a thrown error, so it
  fails silently. `connectToDatabase` calls `UserModel.syncIndexes()` on
  every boot so any environment self-heals.

A user must have `telegramUserId` OR (`email` AND `passwordHash`). Mongoose
schema validation doesn't express "either/or" across fields cleanly, so this
is enforced where users are created (`user.services.ts`), not in the schema.

## Shared schemas (`packages/shared/src/schemas`)

`auth.ts`:
- `emailRegisterSchema`: `{ email: z.string().email(), password: z.string().min(8).max(72), firstName: z.string().min(1) }`
  (72 is bcrypt's input ceiling — longer inputs are silently truncated, so
  reject before that point instead)
- `emailLoginSchema`: `{ email: z.string().email(), password: z.string().min(1) }`

`user.ts`:
- `sessionUserSchema.telegramUserId`: `z.string()` → `z.string().nullable()`
- `sessionUserSchema.email`: new, `z.string().nullable()`

## Backend

**`services/user.services.ts`** — alongside `upsertUserFromTelegramProfile`:
- `createUserWithEmail(email, password, firstName)`: checks `email` isn't
  taken (`ApiError.conflict`), hashes with `bcrypt` (cost 12), creates the
  user (`role: 'participant'` — email accounts are never admin by this path)
- `findUserByEmail(email)`: for login, explicitly `.select('+passwordHash')`
  since it's excluded by default
- `linkTelegramToUser(user, profile)`: sets `telegramUserId` on an existing
  `UserDocument`; throws `ApiError.conflict` if that Telegram id is already
  attached to a *different* user

**`services/auth.services.ts`**:
- `issueSessionForProfile(profile)` → generalized to `issueSession(user: UserDocument)`.
  Telegram call sites (`authenticateWithTelegram`, `authenticateWithTelegramWidget`)
  become `upsertUserFromTelegramProfile(profile)` then `issueSession(user)` —
  same two-step shape they already have via the old helper, just split so
  email/password can reuse the second half without going through the first.
- `registerWithEmail(payload)`: `createUserWithEmail` → `issueSession(user)`
- `authenticateWithEmail(payload)`: `findUserByEmail` → `bcrypt.compare` →
  on mismatch, `ApiError.unauthorized('Incorrect email or password.')` for
  *both* "no such email" and "wrong password" (never reveal which one failed)
  → `issueSession(user)`
- `linkTelegram(user, payload)`: `verifyLoginWidget` (same verification the
  widget route already uses) → `linkTelegramToUser` → returns the refreshed
  `SessionUser` (not a new session/token — the caller is already signed in)

**Routes** (`routes/auth.routes.ts`):
- `POST /auth/register` — `authRateLimit`, `validate(emailRegisterBody)`,
  unauthenticated (same tier as `/auth/telegram`)
- `POST /auth/login` — `authRateLimit`, `validate(emailLoginBody)`,
  unauthenticated
- `POST /auth/telegram/link` — `requireUser`, `authRateLimit`,
  `validate(telegramWidgetAuthBody)` (reuses the existing widget payload shape)

**New dependency**: `bcrypt` (+ `@types/bcrypt`) in `apps/api`. Nothing in the
repo hashes passwords today.

## Frontend

The slot already exists: `RegisterPage.tsx` → `NoSessionNote`, the branch that
renders `<TelegramLoginWidget />` when `status === 'unavailable'` (open web,
no Telegram session). `EmailAuthForm` renders next to it as a second option.

**`apps/web/src/lib/auth/EmailAuthForm.tsx`** (new, mirrors
`TelegramLoginWidget.tsx`'s shape): a form with email/password fields and a
login/signup mode toggle. On submit, calls the matching `authApi` function,
stores the token, and seeds `authKeys.me()` — the same three steps
`TelegramLoginWidget` already does, just triggered by a form submit instead
of a widget callback.

**`apps/web/src/lib/auth/authApi.ts`** — two additions following
`loginWithWidget`'s exact shape (`api.post` → `storeToken` → return session):
- `registerWithEmail(payload): Promise<Session>` → `POST /auth/register`
- `loginWithEmail(payload): Promise<Session>` → `POST /auth/login`
- `linkTelegram(payload): Promise<SessionUser>` → `POST /auth/telegram/link`
  (no `storeToken` — this doesn't issue a new token, just updates the user)

`useAuth` itself doesn't change — same pattern as the widget, where
components call `authApi` directly rather than going through `signIn()`.

**"Connect Telegram"**: a button using `TelegramLoginWidget`'s existing
`window.onTelegramAuth` bridge, but calling `linkTelegram` instead of
`loginWithWidget`, and updating the cached user via
`queryClient.setQueryData` merge rather than seeding a fresh session. Lives
whichever profile/settings screen a signed-in email user has — not designed
here since that screen doesn't exist yet; the plan will scope creating a
minimal one if needed.

## Error handling

- Duplicate email on register → `409 conflict`, surfaced as "That email is
  already in use."
- Wrong credentials on login → `401 unauthorized`, generic message (no user
  enumeration)
- Linking a Telegram account already attached elsewhere → `409 conflict`
- All three unauthenticated routes sit behind `authRateLimit`, same as the
  existing Telegram routes

## Testing

- `services/auth.services.ts`: register creates a user with a hash (not the
  plaintext) and a valid session; login accepts correct credentials and
  rejects wrong ones with the generic message; duplicate email rejected
- `services/user.services.ts`: `linkTelegramToUser` rejects a Telegram id
  already claimed by another user
- Existing Telegram auth tests continue to pass unmodified — confirms the
  `issueSession` split didn't change Telegram's behavior
- No frontend test suite in this project (per standing preference) — verified
  manually: register, log out, log in, then connect Telegram from a
  logged-in email session
