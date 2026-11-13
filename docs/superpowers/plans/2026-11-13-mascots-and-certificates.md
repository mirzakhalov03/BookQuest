# Mascots & Certificates Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove Chick, give every new user a random mascot that greets them on Profile, redesign the Profile certificate section, and move certificate previews and sending to a new admin Certificates page.

**Architecture:** Random assignment is a Mongoose default on `User.avatar`, so every creation path (create, and upserts with `setDefaultsOnInsert`) gets it with no per-path code. A one-off script backfills existing users. The greeting is CSS keyframes plus a `localStorage` "seen" flag. The admin page reuses the existing preview endpoint and moves the send/status logic out of `CertificatesPanel`.

**Tech Stack:** Mongoose, Node `crypto`, React, CSS keyframes, React Query.

**Spec:** `docs/superpowers/specs/2026-11-12-mascots-and-certificates-design.md`

## Global Constraints

- No automated tests (project rule). Verify with `pnpm typecheck` plus the manual check per task.
- Picking **Initials** (`avatar: null`) is never overridden after creation.
- The backfill runs against the **production `bookquest` DB**, not the `.env` default `test` DB. It has a dry-run mode and is idempotent.
- Animations use transform/opacity only, no new animation library, and respect `prefers-reduced-motion`.
- `localStorage` reads/writes are wrapped in try/catch. The page works without it.
- Certificate artwork is **not** part of this work. Swapping it later must be a template-only change.
- All new copy in en/uz/ru. Sans display type. Profile states are designed with `frontend-design`.

## Review Focus

- A user who explicitly picked Initials, then logs in again via Telegram (upsert path): the avatar stays `null`.
- A user whose stored avatar is `'chick'`: before the backfill they see initials, not a broken image; after it, a random mascot.
- Two different accounts on the same device: each gets their own first-time greeting (the flag is keyed by user id).
- The greeting tooltip on a 320px-wide screen doesn't overflow or cover the tab bar.
- The admin Certificates page before results are published: the previews show, and Send is disabled with a reason, never a failing request.

---

### Task 1: Remove Chick and assign random mascots

**Files:**
- Modify: `packages/shared/src/constants/avatar.ts` (drop `'chick'`)
- Delete: `apps/web/src/assets/avatars/chick.webp`
- Modify: `apps/web/src/i18n/{en,uz,ru}/profile.ts` (drop `avatars.chick`)
- Create: `apps/api/src/utils/randomAvatar.ts`
- Modify: `apps/api/src/models/user.model.ts` (`avatar` default)

**Interfaces:**
- Produces: `randomAvatar(): AvatarId` (uniform via `crypto.randomInt(AVATARS.length)`).

- [ ] **Step 1:** Remove `'chick'` from `AVATARS`, delete the image and drop the dictionary keys. Build shared.
- [ ] **Step 2:** Add `randomAvatar()`. Set the model field to `avatar: { type: String, default: randomAvatar }` and update its comment: defaults apply on insert only (`create`, and upserts already pass `setDefaultsOnInsert: true` in `user.services.ts`), so an explicit `null` is kept.
- [ ] **Step 3:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 4: Manual check.** Register a new phone account on the local API: `avatar` is a valid id. Pick Initials, log out and back in: still `null`. The avatar picker grid is 9 tiles (Initials + 8).
- [ ] **Step 5: Commit**

```bash
git add packages/shared apps/api apps/web/src
git commit -m "feat: random mascot for new users; retire the Chick avatar"
```

### Task 2: Backfill script

**Files:**
- Create: `apps/api/src/scripts/assign-random-avatars.ts`
- Modify: `apps/api/package.json` (script `"migrate:avatars"`)

**Interfaces:**
- Consumes: `randomAvatar()` (Task 1), `AVATARS`.

- [ ] **Step 1:** The script connects like the other scripts in `src/scripts/`. It finds users where `avatar` is `null`, missing, or `$nin: AVATARS`, and sets each a `randomAvatar()` (a `bulkWrite` of `updateOne`s, each re-checking the same filter so a re-run is a no-op). `--dry-run` prints the count and the DB name and writes nothing. It always prints the target DB name first.
- [ ] **Step 2:** Run `pnpm --filter @bookquest/api migrate:avatars --dry-run` against the local `test` DB. Expected: it prints the DB name and a count, and writes nothing.
- [ ] **Step 3:** Run it for real locally, then re-run: the second run reports 0.
- [ ] **Step 4: Commit.** Do **not** run it against production as part of this plan. Note in the commit body that it runs once before launch against `bookquest`.

```bash
git add apps/api
git commit -m "chore(api): one-off script to give existing users a random mascot"
```

### Task 3: Profile greeting animation

**Files:**
- Create: `apps/web/src/features/profile/useMascotGreeting.ts`
- Modify: `apps/web/src/features/profile/components/ReaderPass.tsx` (avatar wrapper, tooltip)
- Modify: the profile stylesheet (`grep -rn "reader-pass\|avatar-sheet" apps/web/src/styles` to find it)
- Modify: `apps/web/src/i18n/{en,uz,ru}/profile.ts`

**Interfaces:**
- Produces: `useMascotGreeting(userId: string | undefined, hasMascot: boolean): { variant: 'hello' | 'bounce' | 'none'; showTip: boolean; dismissTip: () => void }`. It returns `'hello'` + `showTip` the first time (`localStorage` key `bq:mascot-seen:<userId>`, set on mount) and `'bounce'` after that. Initials get `'none'`.

- [ ] **Step 1:** Implement the hook. `showTip` auto-dismisses after 3000ms or on `dismissTip`. Storage errors behave as "first time, don't persist".
- [ ] **Step 2:** `ReaderPass` puts `data-greet={variant}` on the avatar wrapper. CSS keyframes: `hello` is a pop-up from below with squash-and-stretch, a wiggle and a sparkle burst (~1.2s). `bounce` is a single ~400ms bounce. Under `prefers-reduced-motion`, no animation, but the tip still shows. The tip is a small speech bubble pointing at the avatar with `t.profile.meetMascot` ("Meet your mascot! Tap to change it"). Fire `haptic('select')` once on `'hello'`.
- [ ] **Step 3:** Add the string in en/uz/ru. Run `pnpm typecheck`.
- [ ] **Step 4: Manual check.** First Profile visit: the hello plays and the tip shows, then fades. Reload: only the bounce. A second account: hello again. With reduced motion on, nothing moves and the tip still shows. Check at 320px.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(profile): mascot greets the reader on Profile"
```

### Task 4: Profile certificate section redesign

**Files:**
- Modify: `apps/web/src/features/profile/ProfilePage.tsx` (`CertificateSection`)
- Modify: `apps/web/src/features/profile/components/Certificate.tsx`
- Create: `apps/web/src/features/profile/components/CertificateTeaser.tsx`
- Modify: `apps/web/src/i18n/{en,uz,ru}/profile.ts`

**Interfaces:**
- Consumes: `useCertificate()` (exists), `useCurrentQuest()` for `resultsAt`, `CertificateData.tier`.
- Produces: `CertificateTeaser({ resultsAt: string }): JSX.Element`.

- [ ] **Step 1:** `CertificateSection` picks one of three states. **Before results:** `CertificateTeaser`, a blurred or silhouetted certificate shape with `t.profile.certTeaser` ("Finish the quiz to earn your certificate") and the formatted results date. **Issued:** the redesigned `Certificate`. **Results out, none issued:** the single muted line `t.profile.certMissed` ("You didn't finish this edition. See you next time").
- [ ] **Step 2:** `Certificate` shows the image as a framed object (tilt-and-settle on scroll-in via `IntersectionObserver`, soft shadow), a tier chip (`t.profile.tiers[tier]`), **Save image** and **Share** buttons (keep the existing save/share mechanism), and the verify code small underneath. Design with `frontend-design`.
- [ ] **Step 3:** Add the strings in en/uz/ru. Run `pnpm typecheck`.
- [ ] **Step 4: Manual check** with the mock API in each of the three states, on a phone width.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src
git commit -m "feat(profile): redesigned certificate section — teaser, issued, missed"
```

### Task 5: Admin Certificates page; results page link

**Files:**
- Create: `apps/web/src/features/admin/certificates/CertificatesPage.tsx`
- Modify: `apps/web/src/features/admin/certificates/CertificatesPanel.tsx` → keep only send/confirm/status (rename to `CertificateDelivery.tsx` if it reads better), with the preview grid moved to the page
- Modify: `apps/web/src/features/admin/screens.ts`, `apps/web/src/app/router.tsx` (`{ path: 'certificates', ...adminScreen('CertificatesPage') }`)
- Modify: `apps/web/src/features/admin/DashboardPage.tsx` (`actionCertificates` gets `to: '/admin/certificates'`)
- Modify: `apps/web/src/features/admin/ResultsInspectionPage.tsx` (remove the panel, add the link line)
- Modify: `apps/api/src/certificates/template.tsx` (export `IS_PLACEHOLDER_ART = true`) and expose it. Simplest is a field on the existing certificate delivery status response, so the web app knows to show the note.
- Modify: `apps/web/src/i18n/{en,uz,ru}/admin.ts`

**Interfaces:**
- Consumes: `certificatePreviewUrl(tier)` (exists), `useCertificateDelivery`/`useSendCertificates` (exist), `CERTIFICATE_TIERS`.
- Produces: the route `/admin/certificates`. `CertificateDelivery.placeholderArt: boolean` in the shared delivery schema.

- [ ] **Step 1:** Build `CertificatesPage`: `AdminPageHeader` with title `t.certificates.title`, the 4-tier preview grid (moved from the panel), the placeholder note `t.certificates.placeholderNote` ("Placeholder design: final artwork coming") when `placeholderArt`, then the delivery section. Before results are published, the delivery section shows `t.certificates.unlocksAt(date)` and a disabled Send.
- [ ] **Step 2:** Register the route and the screen. Point the dashboard tile at it (it stops showing "Soon").
- [ ] **Step 3:** `ResultsInspectionPage`: delete `<CertificatesPanel />`. When published with finishers, render a link line to `/admin/certificates`: `t.results.certificatesReady` ("Certificates are ready to send →").
- [ ] **Step 4:** Add `IS_PLACEHOLDER_ART` and the `placeholderArt` field (shared schema + delivery service + mock). Add all strings in en/uz/ru.
- [ ] **Step 5:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 6: Manual check.** The dashboard Certificates tile opens the page. Four previews plus the placeholder note show. Before results, Send is disabled with the date. After results (mock), sending works as before. The results page has no previews, just the link.
- [ ] **Step 7: Commit**

```bash
git add apps/web/src apps/api packages/shared
git commit -m "feat(admin): Certificates page with tier previews and sending; results page links to it"
```
