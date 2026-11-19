# Refactor & optimization pass — Design

**Goal:** a measured pass over web, API and bot that makes the app **faster for readers** (first load in
Telegram, quiz responsiveness) and **easier to change** (less duplication, smaller files), with no behaviour change.

**Principle:** measure → change → measure. Every change in this pass is justified by a number or a concrete
duplication it removes. No "while I'm here" rewrites.

**Anti-goals:**
- Behaviour changes hiding inside a refactor. Each commit is either a refactor or a fix, never both.
- Touching the quiz flow (`quiz-attempt.services.ts`, `useAttempt.ts`) during live quiz windows. Schedule that work
  outside them.
- Adding dependencies to speed things up.

---

## 1. Audit (first deliverable: `docs/audits/2026-11-refactor-audit.md`)

**Web**
- Bundle: `vite build` with `rollup-plugin-visualizer` run once (a temporary `npx`, not committed) to get the main chunk size and
  the biggest modules. Targets: main entry JS **< 180 KB gzip**, admin stays a separate lazy chunk (it already is, so check).
- Load in Telegram: Lighthouse mobile on `/` (LCP, TBT) plus a manual cold open in the Telegram iOS/Android Mini App.
- Render: React DevTools profiler on Home (the 3D book stage, `Motes`, countdown ticking) and the quiz play screen. Look for
  whole-tree re-renders from the per-second countdown, and Zustand selectors returning new objects.
- Images: cover and poster sizes actually served vs displayed. `loading="lazy"` / `decoding="async"` on
  below-the-fold images. Check fonts for `font-display: swap` and preload of the one display weight.
- React Query: `staleTime` per query (are `quests/current` and `auth/me` refetched on every tab switch?), and persisted cache size.

**API**
- Queries: enable Mongoose debug in a local run of a full reader session plus admin dashboard and log every query. Find
  **N+1s** (e.g. `toSessionUser` → `findParticipantForUser` → `findCurrentQuestDocument` on every `/auth/me`; the
  participants list; results ranking).
- Indexes: `explain('executionStats')` on the 10 most frequent queries. Any `COLLSCAN` on a growing collection is a
  finding (28 indexes are declared today, so check that they're the ones queries use).
- Hot reads: the current quest is read on almost every request. Use a **short in-process cache** (e.g. 5 s, invalidated
  on admin quest save) if the audit shows it's a top query.
- Payloads: response sizes for `/quests/current`, admin participants and the interactions log. Use `.lean()` + projection where
  documents are read only for DTOs.

**Structure and duplication**
- Files over 400 lines: `lib/api/mock/routes.ts` (916), `quiz-attempt.services.ts` (764), `quiz-ops.services.ts`
  (498), `shared/schemas/quiz.ts` (458), `useAttempt.ts` (417). Split by responsibility where a reader can't hold
  the file in their head. The mock routes split per resource, like the real routes.
- Repeated patterns to consolidate (verify each exists more than twice before extracting): GridFS upload/validate (covers,
  and soon certificate designs), duplicate-key → 409 handling, Telegram-verification failure handling in
  `auth.services.ts` (the same three lines appear three times), masked usernames.
- Backend conventions (`controllers/`, `services/`, `routes/`, `validators/`, `*.services.ts` naming): list the
  deviations, and fix the cheap ones.

**Bot**
- Startup work and the interaction-recorder batch size and flush. Usually small, so audit it briefly.

## 2. Fix (second deliverable)

The audit ranks findings by **impact ÷ effort** into three buckets:
- **Do now:** clear wins (an N+1 on `/auth/me`, a missing index, an oversized image, a re-rendering countdown).
- **Do with the next feature that touches it:** splits of big files that aren't hurting yet.
- **Won't do:** with the reason.

Only "do now" items get implemented in this pass, each as its own commit, with the before and after number in the
commit body.

---

## Out of scope
- Framework or library upgrades.
- Server infrastructure (Railway sizing, CDN). Note them in the audit if relevant.
- Automated tests (project rule).
