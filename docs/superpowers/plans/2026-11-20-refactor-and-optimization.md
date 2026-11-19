# Refactor & Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Measure web/API/bot performance and duplication, write a ranked audit, then implement only the "do now" findings, each backed by a before and after number.

**Architecture:** Audit first (`docs/audits/2026-11-refactor-audit.md`), then one commit per fix. Tasks 3–6 are the fixes the code reading already makes likely. Each is **conditional** on the audit confirming it, and is skipped with a note if not.

**Tech Stack:** Vite, React DevTools profiler, Lighthouse, Mongoose debug + `explain`.

**Spec:** `docs/superpowers/specs/2026-11-20-refactor-and-optimization-design.md`

## Global Constraints

- No behaviour change. A refactor commit and a fix commit are never the same commit.
- No new runtime dependencies. Measurement tools run via `npx` and aren't committed.
- Don't touch the quiz flow files during an open quiz window.
- Targets: main entry JS < 180 KB gzip. No `COLLSCAN` on participants, quiz attempts, results, interactions or notifications in the top-10 queries.
- `pnpm typecheck` and `pnpm build` pass after every commit.

## Review Focus

- A current-quest cache serving a stale quest after an admin save: invalidation must run in the same process that saved it, and the TTL caps any other instance's staleness at 5 s.
- `.lean()` swaps: code that relied on document getters or virtuals (`id`, defaults like `randomAvatar`) breaks quietly. Compare DTO output before and after.
- Memoising the countdown: the visible seconds must still tick every second.
- Splitting `mock/routes.ts`: `VITE_MOCK_API=true` still serves every route (click through participant and admin flows).
- Index additions on prod: build them in the background on Atlas, and never drop an index the audit didn't prove unused.

---

### Task 1: Measure and write the audit

**Files:** Create `docs/audits/2026-11-refactor-audit.md`

- [ ] **Step 1: Web bundle.** `pnpm --filter @bookquest/web build`, then record the gzip sizes from Vite's output. Run `npx vite-bundle-visualizer` (or `rollup-plugin-visualizer` via a temporary config) and list the 10 largest modules.
- [ ] **Step 2: Web runtime.** Lighthouse mobile on the deployed `/` (LCP, TBT, CLS). Profile Home for 10 s and the quiz play screen for 1 question, and record the components re-rendering every second.
- [ ] **Step 3: API queries.** Run the API locally with `mongoose.set('debug', true)` (temporary, not committed). Walk through: open the app, `/auth/me`, Home, Book, Prizes, Profile, admin dashboard, participants, results. Tabulate queries per request, then `explain('executionStats')` on the top 10.
- [ ] **Step 4: Duplication and size.** List the files over 400 lines and the repeated patterns from spec §1 with their locations.
- [ ] **Step 5:** Write the audit with the three buckets (do now, do with next feature, won't do) and the before numbers.
- [ ] **Step 6: Commit** `docs: refactor & optimization audit`

### Task 2: Small shared helpers (duplication)

**Files:** `apps/api/src/services/auth.services.ts`, `apps/api/src/utils/telegram.ts`, `apps/api/src/utils/mongo.ts` + callers

**Interfaces:**
- `requireVerified<T>(result: VerifyResult<T>, context: string): T` in `utils/telegram.ts`: logs and throws the `telegram_unverified` error. Replaces the three copies.
- `rethrowDuplicate(error: unknown, conflict: ApiError): never` in `utils/mongo.ts`. Use it where the `isDuplicateKeyError → conflict` pattern repeats.

- [ ] **Step 1:** Extract and replace (only where the audit listed it).
- [ ] **Step 2:** `pnpm typecheck`. Manual check: Mini App sign-in, widget sign-in, phone registration with a taken number → same responses as before.
- [ ] **Step 3: Commit** `refactor(api): shared Telegram-verification and duplicate-key helpers`

### Task 3 (if confirmed): Fewer queries on hot paths

**Files:** `apps/api/src/services/quest.services.ts`, `apps/api/src/services/auth.services.ts`, `apps/api/src/services/participant.services.ts`

**Interfaces:** `findCurrentQuestDocument()` serves from a 5 s in-process cache. `invalidateCurrentQuest(): void` is called from `updateQuest`/`createQuest`. Read-only DTO paths use `.lean()` + projection.

- [ ] **Step 1:** Add the cache plus invalidation. Pass the already-loaded quest through `toSessionUser → findParticipantForUser` (the parameter exists).
- [ ] **Step 2:** Re-run the Task 1 Step 3 walkthrough and record queries per request before and after in the commit body.
- [ ] **Step 3: Commit** `perf(api): cache the current quest briefly; fewer queries per request`

### Task 4 (if confirmed): Indexes

**Files:** the relevant `apps/api/src/models/*.model.ts`

- [ ] **Step 1:** Add only the indexes the `explain` output proved missing. Name them explicitly.
- [ ] **Step 2:** Re-run `explain` and record `totalDocsExamined` before and after.
- [ ] **Step 3: Commit** `perf(api): indexes for <queries>`. Note in the commit body that prod builds them on deploy (Mongoose `autoIndex`). Check whether `autoIndex` is on in prod first, and if not, add them via Atlas.

### Task 5 (if confirmed): Web render and load

**Files:** as the profiler shows, likely `apps/web/src/components/ui/Countdown.tsx`, `features/home/components/*`, image components, `lib/queryClient.ts`

- [ ] **Step 1:** Isolate per-second state in the smallest component (the countdown digits), so parents don't re-render. Use Zustand selectors with `useShallow` where objects are returned.
- [ ] **Step 2:** `loading="lazy" decoding="async"` on below-the-fold images. Preload the display font weight used above the fold.
- [ ] **Step 3:** Set `staleTime` for `quests/current` and `auth/me` from the audit (e.g. 60 s), keeping pull-to-refresh as the manual refresh.
- [ ] **Step 4:** Re-measure Lighthouse and profile, and record before and after.
- [ ] **Step 5: Commit** `perf(web): <specific change>` (one commit per change)

### Task 6 (if confirmed): Split the oversized files

**Files:** `apps/web/src/lib/api/mock/routes.ts` → `mock/routes/{auth,quest,participant,quiz,admin,…}.ts` plus an index. Others only if the audit put them in "do now".

- [ ] **Step 1:** Move code without changing it. One resource per file, mirroring `apps/api/src/routes/`.
- [ ] **Step 2:** `pnpm --filter @bookquest/web typecheck`. Manual check with `VITE_MOCK_API=true` across participant and admin flows.
- [ ] **Step 3: Commit** `refactor(web): split mock routes per resource`

### Task 7: Close out

- [ ] Update the audit with the after numbers and what moved to "do with next feature". Commit `docs: audit results`.
