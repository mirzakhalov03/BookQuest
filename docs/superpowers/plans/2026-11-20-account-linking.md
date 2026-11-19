# Account Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One person, one account: stop phone sign-ups from duplicating a Telegram participant, merge the two accounts when both identities are proven, and clean up the duplicates that already exist.

**Architecture:** A registration guard compares the submitted Telegram contact with **verified** `User.username`s in the current quest. A transactional `mergeUsers` service re-points every `User` reference to the Telegram user and resolves participant clashes. `/auth/telegram/link` calls it instead of refusing. A dry-run-first script applies it to existing pairs.

**Tech Stack:** Express + Mongoose (transactions) + Zod, shared schemas in `@bookquest/shared`, React + React Query.

**Spec:** `docs/superpowers/specs/2026-11-20-account-linking-design.md`

## Global Constraints

- No automated tests (project rule). Verify with `pnpm typecheck` plus the manual check per task.
- Only a **verified** `User.username` (from Telegram) can trigger the guard or a merge. Never a typed participant contact, never a name or phone.
- The Telegram user always survives a merge. Phone + password hash move onto it.
- `mergeUsers` runs inside one Mongo transaction (`mongoose.startSession()` + `withTransaction`).
- Both sides have quiz attempts in the same quest → `409 merge_conflict`, nothing changes.
- New copy in `en`, `uz`, `ru`. Error reasons are added to `apps/web/src/i18n/*/errors.ts`.
- Keep the web mock API (`apps/web/src/lib/api/mock/`) in step: the new 409 reason and the link response shape.

## Review Focus

- A family: a parent registers on the site with their child's Telegram handle as the contact, and the child has a Telegram account. The guard fires. That's expected, and the card must still let the parent continue with "Not you? Continue anyway" → registers with a phone contact instead.
- The caller links a Telegram account that has **no** participant: a plain attach, with no new session needed but harmless if issued.
- A merge where the dropped user is an admin phone number (`adminPhoneNumbers`): the survivor must keep admin access (`isAdmin` reads `phoneNumber` + `role`, so copy `role` too).
- Someone retries the link after a network drop mid-merge: the transaction means the retry sees either both users or one, never a half state.
- After a merge, the old token (naming the deleted user) is rejected cleanly (401 → re-auth), not a 500.

---

### Task 1: Registration guard

**Files:**
- Modify: `apps/api/src/services/participant.services.ts` (`registerParticipant`)
- Create: `apps/api/src/services/duplicate-guard.services.ts`
- Modify: `apps/web/src/i18n/{en,uz,ru}/errors.ts`, `apps/web/src/lib/api/mock/routes.ts`

**Interfaces:**
- Produces: `findTelegramOwnerOfContact(questId: Types.ObjectId, contact: { method: ContactMethod; value: string }, callerId: Types.ObjectId): Promise<{ username: string } | null>`. It returns the other user only when `contact.method === 'telegram'`, a `User` with that `username` (case-insensitive, built with the `parseTelegramUsername` pattern trick from `login-code.services.ts`) exists, isn't the caller, **and** has a participant in `questId`.
- 409 payload: `ApiError.conflict(msg, { reason: 'already_registered_elsewhere', handle: '@mir…' })`. Reuse a masked-handle helper. Move `maskUsername` from `login-code.services.ts` to `apps/api/src/utils/mask.ts` and import it in both places.
- `registerParticipant` accepts an optional `payload.confirmNotDuplicate?: boolean` (add to `registerParticipantSchema`, default false). When true, the guard is skipped. This is the "Not you?" path.

- [ ] **Step 1:** Add `confirmNotDuplicate` to the shared register schema and build shared.
- [ ] **Step 2:** Implement `findTelegramOwnerOfContact` and call it in `registerParticipant` right after the `already` check.
- [ ] **Step 3:** Add the error copy and the mock behaviour (mock: handle `@taken` triggers the 409).
- [ ] **Step 4:** `pnpm typecheck` passes.
- [ ] **Step 5: Manual check.** Against the local DB, register user A in Telegram (or seed a user with `username: 'alice_tg'` + participant). Sign up a phone user, register with contact `@Alice_TG` → 409 `already_registered_elsewhere`. Same with `confirmNotDuplicate: true` → 201.
- [ ] **Step 6: Commit** `feat(api): flag a sign-up whose Telegram contact already has an account`

### Task 2: Web — the "you already joined" card

**Files:**
- Modify: `apps/web/src/features/registration/JoinQuest.tsx` (or the form component under `registration/components/` that submits)
- Modify: `apps/web/src/lib/auth/AuthScreen.tsx`, `apps/web/src/lib/auth/TelegramCodeLogin.tsx`
- Modify: `apps/web/src/i18n/{en,uz,ru}/{registration,auth}.ts`

**Interfaces:**
- Consumes: the 409 `reason: 'already_registered_elsewhere'` + `handle` from Task 1.
- Produces: `AuthScreen` reads an optional `?tab=registered&identifier=<handle>` from the URL (via `useSearchParams`). `TelegramCodeLogin` accepts `defaultIdentifier?: string`.

- [ ] **Step 1:** On that error, replace the form error with a card: `registration.alreadyJoinedTitle` ("You've already joined in Telegram"), `registration.alreadyJoinedBody(handle)`, primary button `registration.signInInstead`, quiet link `registration.notYou` ("Not you? Continue anyway") that resubmits with `confirmNotDuplicate: true`.
- [ ] **Step 2:** "Sign in instead" signs out (the existing sign-out in `useAuth`) and navigates to the auth screen with `?tab=registered&identifier=<raw handle from the form>`. Pass the handle the user typed, not the masked one.
- [ ] **Step 3:** `AuthScreen` honours the query on first render. `TelegramCodeLogin` prefills.
- [ ] **Step 4:** Add the "Joined in Telegram already? Sign in instead." line under the `new` tab (`auth.alreadyInTelegram`), switching to `registered`.
- [ ] **Step 5:** `pnpm --filter @bookquest/web typecheck`. Manual check with `VITE_MOCK_API=true` and contact `@taken`: the card shows, both buttons work.
- [ ] **Step 6: Commit** `feat(web): point duplicate sign-ups to their existing Telegram account`

### Task 3: `mergeUsers` service and merging link

**Files:**
- Create: `apps/api/src/services/account-merge.services.ts`
- Modify: `apps/api/src/services/user.services.ts` (`linkTelegramToUser`)
- Modify: `apps/api/src/services/auth.services.ts` (`linkTelegram`) and its controller/route response
- Modify: `packages/shared/src/schemas/auth.ts` (link response)
- Modify: `apps/web/src/features/profile/components/ConnectTelegram.tsx`, `apps/web/src/lib/auth/authApi.ts`, `tokenStore.ts` usage

**Interfaces:**
- Produces: `mergeUsers(keep: UserDocument, drop: UserDocument): Promise<UserDocument>`.
- `linkTelegram` now returns `Session` (token + user), not `SessionUser`. Shared: `linkTelegramResponseSchema = sessionSchema`.
- References to re-point, in the same transaction (`updateMany({ <field>: drop._id }, { $set: { <field>: keep._id } }, { session })`):
  `Participant.user`, `Notification.user`, `LoginCode.user`, `BotInteraction.user`, `QuizAttempt.user`, `QuizAttempt.voidedBy`, `Broadcast.createdBy`, `CertificateDelivery.startedBy`, `Quiz.createdBy`, `Quiz.corrections.by` (array path: `{ 'corrections.by': drop }` with `$[el]` arrayFilters. Check the actual field name at `quiz.model.ts:38`).

- [ ] **Step 1:** Participant clash resolution, per quest where both have a participant: count `QuizAttempt`s per participant's user in that quest. Both > 0 → throw `ApiError.conflict(…, { reason: 'merge_conflict' })`. Otherwise keep the one with attempts, else the lower `number`. Delete the other and `$inc: { participantCount: -1 }` on its quest. Do this **before** re-pointing `Participant.user`, so the unique `quest+user` index never collides.
- [ ] **Step 2:** Re-point all references (list above). Copy `phoneNumber`, `passwordHash` (select `+passwordHash` on `drop`) and `role` onto `keep` when `keep` lacks them. Unset them on `drop` first, then delete `drop` (the partial unique indexes would collide otherwise). Save `keep`. All inside `withTransaction`.
- [ ] **Step 3:** `linkTelegramToUser`: when `claimedBy` is another user, `return mergeUsers(claimedBy, user)` instead of throwing. `linkTelegram` then returns `issueSession(survivor)`.
- [ ] **Step 4:** Web: `ConnectTelegram` stores the new token (`tokenStore.set`), sets `authKeys.me()` to the session user, invalidates queries, and toasts `profile.accountsMerged`. On `merge_conflict`, shows `errors.merge_conflict` ("Both accounts took the quiz. Message us and we'll sort it out.").
- [ ] **Step 5:** `pnpm typecheck`.
- [ ] **Step 6: Manual check** (local DB): seed a Telegram user T with participant #3000 and a phone user P with participant #3002, no attempts. Sign in as P, link with T's widget payload (or call the service from a scratch script) → one user remains with `telegramUserId` + `phoneNumber`, participant #3000 kept, #3002 deleted, `participantCount` dropped by 1. Repeat with an attempt on #3002 → #3002 kept. Attempts on both → 409, both users intact.
- [ ] **Step 7: Commit** `feat(api): merge accounts when a phone user links an existing Telegram account`

### Task 4: Clean-up script and duplicate chip

**Files:**
- Create: `apps/api/src/scripts/merge-duplicate-users.ts` (pattern: `assign-random-avatars.ts`)
- Modify: `apps/api/package.json` (script entry, like the existing ones)
- Modify: `apps/api/src/services/admin.services.ts` (participants list) + shared admin participant schema: `possibleDuplicate: boolean`
- Modify: `apps/web/src/features/admin/components/ParticipantsTable.tsx`, `apps/web/src/i18n/*/admin.ts`

**Interfaces:**
- Consumes: `mergeUsers` (Task 3).
- `possibleDuplicate` is true when another participant in the same quest has the same `fullName` (case- and space-insensitive) **and** the same contact value.

- [ ] **Step 1:** Script: for the current quest, find phone-only users (no `telegramUserId`) whose participant contact is `telegram`, look up a `User` with that verified `username`, and print `#drop → #keep`. `--apply` calls `mergeUsers(telegramUser, phoneUser)` per pair and logs the outcome. Default is a dry run.
- [ ] **Step 2:** Compute `possibleDuplicate` in the participants list (one aggregation pass, group by normalised name + contact) and show a small amber chip in the row.
- [ ] **Step 3:** `pnpm typecheck`. Run the script dry against `test`, then (with the user's go-ahead) `MONGODB_DB=bookquest pnpm --filter @bookquest/api merge-duplicates` dry → review → `--apply`. Expected for prod today: one pair, `#3002 → #3000`.
- [ ] **Step 4: Commit** `chore(api): merge-duplicate-users script; admin flags possible duplicates`
