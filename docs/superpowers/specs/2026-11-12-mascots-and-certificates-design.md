# Mascots & certificates — Design

**Goal:**
1. Every reader **has a mascot from day one**, assigned at random, and *notices* it. It greets them
   with an animation when they open Profile.
2. The avatar picker loses the **Chick** mascot.
3. The **certificates section** gets a redesign on Profile and a proper home in admin, ready to drop
   in the final certificate artwork, **which arrives later**.

**Why now:** the 22 November 2026 launch. A random mascot makes a brand-new profile feel alive
instead of showing two initials in a circle. Certificates come at the end of the quest, so the
plumbing ships now and the artwork goes in before results day.

**Anti-goals:**
- An animation that plays so often or so long it gets annoying, or that ignores
  `prefers-reduced-motion`.
- Someone who deliberately picked *Initials* getting a mascot forced back on them.
- The admin Certificates page showing placeholder art as if it were final.

---

## 1. Remove Chick

- `AVATARS` (`packages/shared/src/constants/avatar.ts`): remove `'chick'`. Delete
  `apps/web/src/assets/avatars/chick.webp` and its `profile.avatars.chick` strings (en/uz/ru).
- Existing users with `avatar: 'chick'` already read as `null` (`isAvatarId` check in
  `auth.services.ts`). The backfill in §2 gives them a new random mascot.

## 2. Random mascot assignment

**Server-side, at creation.** `User.avatar` gets a Mongoose default of `randomAvatar()`
(`utils/randomAvatar.ts`). Every creation path, `UserModel.create` and the upserts in
`user.services.ts` (which pass `setDefaultsOnInsert: true`), picks it up with no per-path code.

- Random, not hashed from the id. My call: uniform `crypto.randomInt`.
- **Initials stays an option** in the picker. Picking it sets `avatar: null`, and nothing re-assigns
  it later, because assignment only happens at creation and in the one-off backfill.

**Backfill (one-off script)** `apps/api/src/scripts/assign-random-avatars.ts`: every user whose
`avatar` is `null` **or** not a valid `AVATARS` id gets a random one. It runs once, before launch,
against the **production `bookquest` DB** (not the `.env` default `test` DB). Dry-run flag that prints
counts first. Idempotent.

Since demo data is being wiped for launch, the backfill mostly matters for staff/test accounts that
survive the wipe. Still worth having for correctness.

## 3. The Profile greeting animation

On `ProfilePage`, the avatar (`ReaderPass` / `Avatar`) plays an entrance when the page mounts:

- **First time a reader sees their mascot** (tracked in `localStorage`, try/catch, keyed by user id):
  a bigger "hello". The mascot pops up from below with a squash-and-stretch bounce, a small wave or
  wiggle, and a soft sparkle burst. A one-line speech-bubble tooltip, "Meet your mascot! Tap to
  change it", points at the avatar for ~3s or until tapped. A single light haptic.
- **Every visit after:** a short, subtle bounce (~400ms) when Profile opens. Enough to feel alive,
  never in the way.
- `prefers-reduced-motion`: no movement. The first-time tooltip still shows (it's information,
  not decoration).
- CSS keyframes (transform/opacity only). No new animation library.

Tapping the avatar opens `AvatarPicker` (as today).

## 4. Avatar picker

`AvatarPicker.tsx` keeps its 3-column grid, Initials tile first. With Chick gone the grid is
Initials + 8 mascots = 9 tiles, a clean 3×3. No other change.

## 5. Certificates on Profile (participant)

Today `ProfilePage` → `CertificateSection` → `components/Certificate.tsx` shows the certificate image
once it's issued. Redesign the **section**, independent of the artwork:

- **Before results:** a locked teaser card. A blurred or silhouetted certificate shape with
  "Finish the quiz to earn your certificate" and the results date. It makes the reward visible
  from day one, which matters for launch.
- **Issued:** the certificate image as a framed object (slight tilt-and-settle on scroll-in, soft
  shadow), the tier shown as a chip (Gold / Silver / Bronze / Participant), and two clear actions:
  **Save image** and **Share** (keep whatever save path the certificates spec settled on for Telegram
  webviews). The verify code shown small underneath.
- **Not finished (results out, no result):** a gentle "You didn't finish this edition. See you
  next time" line. No sad empty state.

The builder designs these states with `frontend-design`, in the existing tokens and sans display type.

## 6. Admin: a Certificates page with the real designs

- The dashboard quick action **Certificates** (`DashboardPage.tsx` → `QUICK_ACTIONS`, currently
  "Soon") gets `to: '/admin/certificates'`.
- New route and screen `features/admin/certificates/CertificatesPage.tsx` (registered in
  `features/admin/screens.ts` and `router.tsx`). It shows:
  1. The four tier designs (gold, silver, bronze, participant) rendered by the **real** server
     template, filled with a clearly sample name ("Your Name", #3000). It uses the existing preview
     endpoint (`certificate.routes.ts` → `getPreview`, `previewUrl.ts`). The preview is the actual
     template, so the page is never out of date with what readers receive.
  2. The delivery status and **Send certificates** action, moved here from the results page
     (the `CertificatesPanel` send/confirm/status logic, as is). Before results are published, the
     send area explains when it unlocks.
- **Results page (`ResultsInspectionPage`):** remove the sample previews. In their place, once
  published with finishers, show a single line linking to `/admin/certificates` ("Certificates
  are ready to send →").

**Artwork arrives later.** The template (`apps/api/src/certificates/template.tsx`) stays as is until
the files come. Until then, the admin page shows a small "Placeholder design: final artwork
coming" note. It's driven by one constant in the template module, removed when the real artwork
lands. Swapping the artwork must be a template-only change. Nothing in this spec should
depend on the current visuals.

---

## Out of scope
- The certificate artwork itself.
- PDF export, Story sharing (per the certificates spec).
- More mascots.

## i18n
New strings in `en`, `uz`, `ru`: the mascot tooltip, the certificate teaser/issued/not-finished
copy, tier chips, the admin page title/placeholder note, and the results-page link line.
