# One person, one account — Design

**Goal:** someone who signs up in Telegram and on bookquest.uz ends up with **one** account and **one**
participant number. When they sign in on the site, it finds the account they already have.

**The bug (2026-11-19):** the same person registered twice, as #3000 in the Mini App and #3002 on the
site, with the same name, phone and `@mirzakhalov03`. Signing in on the site couldn't find the Telegram account.

**Root cause (from the code):**
- The Mini App and the Login Widget find or create a `User` by **`telegramUserId` only**
  (`upsertUserFromTelegramProfile`, `user.services.ts`). Telegram never sends a phone number there.
- Site sign-up (`registerWithPhone` → `createUserWithPhone`) creates a `User` by **`phoneNumber` only**,
  with no Telegram id.
- So the two paths never check each other's key, and two `User`s exist. Each one then registers a `Participant` (unique per
  `quest + user`, so nothing stops it).
- Telegram-code sign-in (`login-code.services.ts`) then finds either the site user (no
  `telegramUserId`, so it can't send a code) or **two** candidates (it refuses to guess). Either way it fails with
  "We couldn't send a code to that."
- `linkTelegramToUser` exists (Profile → Connect Telegram), but it **refuses** when the Telegram id
  already belongs to another user. It attaches, it never merges.

**Anti-goals:**
- Merging on unverified data. Names and typed contacts are free text. Two family members can share a phone.
- Losing a participant number, quiz attempt, result or certificate in a merge.
- Making sign-up harder for the common case: a brand-new person on the site.

---

## 1. Prevent: catch the duplicate before it's created

**Site sign-up, before the participant registers.** `registerParticipant` checks the current quest for a
participant whose **owning `User`** has a verified Telegram `username` equal to the submitted Telegram
contact (case-insensitive, `@` optional). If that user isn't the caller, respond `409 already_registered_elsewhere`
with the masked handle (`@mir…`).

- Only a **verified** `User.username` counts, never another participant's typed contact (planted contacts
  must not block real people). This matches the trust order `findCandidateUserIds` already uses.
- Phone contacts are **not** checked. They are shared in families, and the participant index is deliberately not unique.

**Web (`JoinQuest` / registration form):** on `already_registered_elsewhere`, show an inline card instead
of an error: "Looks like you already joined in Telegram as @mir…. Sign in with a Telegram code to use that
account." with a button that signs out of the fresh phone account and opens the **"I'm registered" tab** on the
Telegram-code form, prefilled with the handle.

**Auth screen copy:** under the "New here" tab, one quiet line: "Joined in Telegram already? Sign in
instead." It switches tabs.

## 2. Repair: merge when both identities are proven

`POST /auth/telegram/link` already proves both sides: the caller holds the phone session, and the widget payload
is a verified Telegram identity. When the Telegram id belongs to **another** user, merge instead of refusing:

`mergeUsers(keep: UserDocument, drop: UserDocument): Promise<UserDocument>` in a new
`apps/api/src/services/account-merge.services.ts`:

- **Who survives:** the **Telegram user** (it's the Mini App identity, and notifications and DMs key off it). Copy
  `phoneNumber` + `passwordHash` from the phone user onto it, so password sign-in keeps working.
- **Per quest, participants:**
  - Only one side registered → re-point that participant's `user` to the survivor.
  - **Both registered in the same quest** → keep the one with **any quiz attempt or result**. If neither or both have one,
    keep the **lower number** (registered first). The other participant is deleted and the quest's
    `participantCount` is decremented. If both have attempts, **don't merge**: return `409 merge_conflict` and leave the
    rest to an admin.
- **Re-point everything else** that references the dropped user: quiz attempts, results, certificate
  deliveries, notifications, login codes, bot interactions (grep every model for `ref: 'User'`; the plan lists them).
- Delete the dropped user last. Run it in a **Mongo transaction** (Atlas supports it). A half-merge is worse than none.
- Log the merge (`logger.info` with both ids and the kept/dropped participant numbers).

The response is the survivor's `SessionUser` **plus a new session token**, because the caller's token named the
dropped user. The web stores the new token and refetches `me`.

**Also from Telegram-code sign-in:** no change. Once accounts merge, the handle resolves to one user.

## 3. Clean up existing duplicates

A one-off script `apps/api/src/scripts/merge-duplicate-users.ts`:
- Finds pairs in the current quest where a phone-only user's participant has a Telegram contact equal to a
  Telegram user's verified `username`.
- `--dry-run` (default) prints the pairs and what would happen. `--apply` runs `mergeUsers` on each.
- Runs against prod deliberately: `MONGODB_DB=bookquest` (see memory note: `.env` points to `test`).

## 4. Admin visibility

The Participants table shows a small "Possible duplicate" chip on rows that share a full name **and**
Telegram contact with another row in the same quest. It's display only, with no admin merge button in v1 (the script covers it).

---

## Out of scope
- Asking the Mini App for a verified phone (`requestContact`). Worth doing later, because it would let phone
  sign-in match Telegram users automatically.
- Merging accounts across editions with different numbers (each edition stands alone).
- An admin "merge these two" button.

## i18n
New strings in `en`, `uz`, `ru`: the already-registered card and button, the auth-screen line, the merge success
toast ("Your accounts are now one"), the merge-conflict message, and the duplicate chip.
