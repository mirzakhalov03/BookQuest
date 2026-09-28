# Telegram code login and `/me` as the one place to join — design

Date: 2026-09-28
Status: approved in brainstorming, awaiting spec review

## Goal

- **Mini App:** a Telegram user never sees a password. They are signed in by `initData` on open (already true), tap **You**, fill in the join form, see their number, and land on their profile. Coming back later needs no sign-in (already true).
- **Web, returning Telegram user:** logs in without a password by typing their reg number, phone or @username and entering a 6-digit code the bot sends to their Telegram.
- **Web, new user:** phone + password sign-up stays as it is.
- **`/me` owns everything about "you"**: signing in, joining the quest, the number reveal, the profile. `/register` goes away.

## Decisions (from brainstorming)

| Question | Decision |
|---|---|
| Web login for Telegram users | A one-time code sent by the bot (not a name + reg number + phone check — those are public or guessable) |
| What the user types to get a code | Any one of: reg number, phone, @username |
| Mini App `/me` for an unjoined user | The join form inline on `/me`, then the number reveal, then the profile |
| Web signed-out layout | Two tabs: "New here" / "I'm registered" |
| Code storage | A short-lived `LoginCode` record in MongoDB (not a stateless token, not a magic link) |
| `/register` route | Removed; redirects to `/me` |

## 1. `/me` is the only place to join

### Flow

```
Mini App open → initData sign-in (existing) → You tab
  ├─ has participant      → ProfilePage (existing)
  ├─ no participant, quest open → JoinQuest → /me/welcome (reveal) → "See your profile" → /me
  └─ no quest open        → slim profile + "The next edition opens soon"
```

The same flow applies to a web user signed in by password or code who hasn't joined yet.

### Changes

- **`ProfilePage`**: on participant `404`, render `JoinQuest` instead of `<Navigate to="/register">`. When there's no current quest (`useCurrentQuest` → `404`), render the slim profile with the note instead.
- **`features/profile/components/JoinQuest.tsx`** (new): `AuthHero` + the existing `RegistrationForm`, unchanged in behaviour. The hero's small top label carries the edition mark ("IV · Fourth annual…") from the removed title page.
- **`lib/auth/AuthHero.tsx`** (new): the gradient header pulled out of `AuthScreen` (`label`, `title` props; the `.auth-hero` styles). Used by `AuthScreen` and `JoinQuest`.
- **The reveal** moves from `/register/success` to `/me/welcome`, as a child of the `/me` `RequireAuth` route. It stays chromeless. Its one button reads **"See your profile"** and navigates to `/me`. `RegistrationForm` navigates to `/me/welcome` on success.
- **Router**: remove `/register` and `/register/success`; add `{ path: '/register', element: <Navigate to="/me" replace /> }` so old links and bookmarks still work.
- **`AppLayout`**: the chromeless list swaps `/register` and `/register/success` for `/me/welcome`.
- **`QuestAction`** ("Join BookQuest") → `/me`.
- **Delete** `features/registration/RegisterPage.tsx` and its `NoSessionNote`. The title-page-only CSS in `register.css` (`.view--register`, `.titlepage*`, `.lede`, `.edition`) goes with it; `.form`, `.success*` and the keyframes stay. `SuccessScreen`, `RegistrationForm`, `useRegister` and `revealHandoff.store` stay in `features/registration/`.

## 2. Web signed-out screen (`AuthScreen`)

Shown by `RequireAuth` when `status === 'unavailable'` (the open web). The Mini App never sees it; its `anonymous` state keeps the existing "Sign in again" panel.

```
AuthHero (title follows the tab)
Switch: [ New here | I'm registered ]
───────────────────────────────
New here      → PhoneAuthForm mode="signup"          title: "Register to win the prizes"
I'm registered → TelegramCodeLogin (default)         title: "Welcome back"
                 └─ link: "Signed up here with a password? Log in with password"
                      → PhoneAuthForm mode="login"  (with a link back to the code)
```

- **Tabs** reuse `components/ui/Switch`, the same control as the join form's Telegram/Phone toggle.
- **`PhoneAuthForm`** takes `mode` only. Its internal "Register / Log in" toggle link and the `onModeChange` prop are removed, since the screen owns navigation.
- **`lib/auth/TelegramCodeLogin.tsx`** (new), two steps held in local state:
  1. **Identify**: one `Field`, "Reg number, phone or @username", with the hint "We'll send a code to your Telegram", and a **Send code** button.
  2. **Code**: "Sent to your Telegram (`sentTo`)", one `Field` (`inputMode="numeric"`, `autoComplete="one-time-code"`, `maxLength={6}`), a **Log in** button, **Resend code** (disabled for 60s with a visible countdown via the existing `useCountdown`), and **Use something else**, which goes back to step 1.
  - On success it seeds `authKeys.me()` with `session.user`, the same way `PhoneAuthForm` does. The guard then re-renders into `/me`.
- **The Telegram Login Widget is removed from `AuthScreen`.** It stays in the codebase for `ConnectTelegram` on the profile.
- `lib/auth/authApi.ts` gains `requestTelegramCode(identifier)` and `verifyTelegramCode(challengeId, code)`; the latter calls `storeToken`.

## 3. API

### Endpoints

Both go in `auth.routes.ts` behind the existing `authRateLimit`, and each is validated with `validate(...)`.

| Endpoint | Body | Success |
|---|---|---|
| `POST /auth/telegram-code/request` | `{ identifier: string }` (trimmed, 1–64 chars) | `{ challengeId: string, sentTo: string }` |
| `POST /auth/telegram-code/verify` | `{ challengeId: string, code: /^\d{6}$/ }` | `Session`, via `issueSession` |

The schemas `telegramCodeRequestSchema` and `telegramCodeVerifySchema`, plus the `TelegramCodeChallenge` response type, go in `packages/shared/src/schemas/auth.ts`.

### Files

- `models/login-code.model.ts`: `{ user: ObjectId (ref User, indexed), codeHash: string, attempts: number (default 0), expiresAt: Date }`, with a TTL index on `expiresAt` (`expireAfterSeconds: 0`) and `timestamps: true`. `createdAt` drives the resend cooldown.
- `services/login-code.services.ts`: `resolveLoginIdentifier`, `requestLoginCode`, `verifyLoginCode`.
- `controllers/auth.controllers.ts`: two thin handlers.
- `validators/auth.validators.ts`: re-exports the two shared schemas.
- New env var `LOGIN_CODE_SECRET` (min 32 chars), the HMAC key, added to the `config/env.ts` schema and `.env.example`.

### Resolving the identifier

1. `^#?\d{1,4}$` → reg number in the **current** quest → `participant.user`.
2. Starts with `@`, or `^[A-Za-z][A-Za-z0-9_]{4,31}$` → Telegram username, case-insensitive, matched on `User.username` **or** a quest contact of method `telegram`. The leading `@` is stripped on both sides before comparing.
3. Otherwise, `parsePhoneNumber` → match quest contacts of method `phone` **and** `User.phoneNumber`. If it doesn't parse, `400 { fields: { identifier } }`.
4. De-duplicate the resulting user ids:
   - 0 users → `404` "We couldn't find anyone with that."
   - More than 1 → `409` "That matches more than one person — try your reg number or @username."
   - The user has no `telegramUserId` → `422` "That account isn't connected to Telegram — log in with your password."

### Request

1. Resolve the user (above).
2. If the user has a `LoginCode` with `createdAt` less than 60s ago → `429` "Wait a minute before asking for another code."
3. Delete the user's existing codes (one active code per user).
4. `code = crypto.randomInt(0, 1_000_000)` zero-padded to 6 digits; store `codeHash = HMAC-SHA256(LOGIN_CODE_SECRET, code)` and `expiresAt = now + 10 min`.
5. Send through `sendTelegramMessage`: *"Your BookQuest login code: 482913. It expires in 10 minutes. If you didn't ask for this, ignore this message."*
6. If the send returns `false` → delete the code, then `422` "We couldn't reach your Telegram. Open @\<bot\> in Telegram, tap Start, then try again."
7. Return `{ challengeId: loginCode.id, sentTo }`. `sentTo` is the masked username (`@jav…`), or "your Telegram" when the user has none.

### Verify

1. Find the `LoginCode` by `challengeId`, also checking `expiresAt > now` (the TTL sweep can lag by up to about a minute). Missing or expired → `410` "That code expired. Send a new one."
2. Compare with `crypto.timingSafeEqual` on the HMAC digests.
3. Wrong: `$inc attempts`. If attempts reaches 5, delete it → `410` (same message). Otherwise `400 { fields: { code: "That code isn't right — N tries left." } }`.
4. Right: delete it (single use), then `issueSession(user)`.

## 4. Error states

| Case | Where it shows |
|---|---|
| Wrong code | The code `Field` in the bad state with a shake; "N tries left" |
| Expired, or out of tries (`410`) | The form line; the field clears; a **Send a new code** action |
| `429` (cooldown or `authRateLimit`) | The form line; the resend countdown shows the remaining time |
| `404` / `409` / `422` from the request | The form line on step 1 |
| Network failure | `FALLBACK_MESSAGE` |

Admins get no special path: the role comes from the Telegram id and flows through `issueSession`.

## Out of scope (follow-up)

**Duplicate accounts across sign-in methods.** A user who signs up on the web with phone + password and later opens the Mini App gets a second, Telegram-only account from the `initData` upsert. "Connect Telegram" on the web account then fails with `409`. This exists today; this design makes it more likely. Fixing it needs account merging and is its own design.

## Verification

No automated tests (project preference). Instead:

- Typecheck `packages/shared`, `apps/api` and `apps/web`.
- In the browser against the dev API and bot:
  - web sign-up
  - code log-in by reg number, phone and @username, with a real code delivered to Telegram
  - a wrong code, then running out of tries, then an expired code
  - the resend cooldown
  - a password account with no Telegram (expect `422`)
  - password log-in
  - joining through `/me` → `/me/welcome` → the profile
  - the no-quest state
  - `/register` redirecting to `/me`
