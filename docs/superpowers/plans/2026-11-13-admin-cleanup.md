# Admin Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A full-width results title with an icon-only refresh, no Posters tile, and a quiz section that defaults to "one quiz" with the split options and checks tucked away.

**Architecture:** Web-only. `AdminPageHeader` gets a stacked layout. `RefreshButton` becomes icon-only. `QuizConfigSection` gains an "advanced split" disclosure and a collapsed readiness summary. No API or data changes.

**Tech Stack:** React, react-hook-form, Tailwind, lucide-react.

**Spec:** `docs/superpowers/specs/2026-11-12-admin-cleanup-design.md`

## Global Constraints

- No automated tests (project rule). Verify with `pnpm typecheck` plus the manual check per task.
- `quizConfig` keeps its shape (`distribution` + `quizIds`). No API changes.
- Readiness problems are always one tap away. They're never removed.
- The "no quiz yet" emergency banner and the lock banner stay.
- All copy changes in en/uz/ru. Remove strings that become unused.

## Review Focus

- A quest saved with `distribution: 'parity'` opens with the split already expanded, and its picks are intact.
- Collapsing the split toggle on an unsaved parity/random config: the spec doesn't say. Expected: it switches back to `single`, keeps the first group's quiz, and marks the form dirty, so it never silently saves something the admin can't see.
- The readiness summary counts only failing checks ("2 things to fix") and reads "Ready" when none fail. When it's not ready, it starts expanded if the quiz opens within 24h.
- The icon-only refresh button keeps a visible focus ring and an `aria-label` for keyboard and screen-reader users.
- The results title wraps long "Published 22 November 2026" text across the full width on 320px without clipping.

---

### Task 1: Results header and icon refresh

**Files:**
- Modify: `apps/web/src/features/admin/components/AdminPageHeader.tsx`
- Modify: `apps/web/src/features/admin/components/RefreshButton.tsx`
- Modify: `apps/web/src/features/admin/ResultsInspectionPage.tsx`, `DashboardPage.tsx`, `ParticipantsPage.tsx` (call sites)
- Modify: `apps/web/src/i18n/{en,uz,ru}/admin.ts`

**Interfaces:**
- Produces: `AdminPageHeader` prop `stacked?: boolean`. When true, the title row is full width and the actions sit on their own row, right-aligned, above the title. `RefreshButton({ onRefresh, refreshing }: { onRefresh: () => void; refreshing: boolean })`. The `updatedAt` prop and the time text are removed.

- [ ] **Step 1:** `RefreshButton` becomes a 44×44 icon button: `RotateCw` spinning while `refreshing`, `aria-label={t.refresh}`, a visible focus ring, and `disabled` while refreshing. Delete `clock` and the `updatedAt` prop, and update every call site.
- [ ] **Step 2:** Add `stacked` to `AdminPageHeader` and use it on `ResultsInspectionPage`. Check the other admin pages. If stacked looks better everywhere, make it the default and drop the prop (spec: builder's call).
- [ ] **Step 3:** Add `admin.refresh` ("Refresh") in en/uz/ru. Remove the now-unused "Updated…"/"Updating…" strings if they're hardcoded or in the dictionary.
- [ ] **Step 4:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 5: Manual check.** At 320px and 390px, the results title spans the width. The refresh is a small icon that spins on tap and during the background poll. Pull-to-refresh still works on the page.
- [ ] **Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat(admin): full-width results title and icon-only refresh"
```

### Task 2: Remove the Posters tile

**Files:**
- Modify: `apps/web/src/features/admin/DashboardPage.tsx` (`QUICK_ACTIONS`, grid columns, `Image` import)
- Modify: `apps/web/src/i18n/{en,uz,ru}/admin.ts` (`actionPosters`)

- [ ] **Step 1:** Remove the `actionPosters` entry and its key from the `QUICK_ACTIONS` type. Change the grid to `grid-cols-2`. Drop the `Image` import and the `actionPosters` strings. If no tile is left "Soon" (true once the mascots & certificates plan's Task 5 has landed), remove the "Soon" branch and the `soon`/`comingSoon` strings too. Otherwise keep it.
- [ ] **Step 2:** Run `pnpm typecheck`. Manual check: the dashboard shows Quizzes · Certificates in two columns.
- [ ] **Step 3: Commit**

```bash
git add apps/web/src
git commit -m "chore(admin): remove the Posters placeholder from the dashboard"
```

### Task 3: Simplify the quiz section

**Files:**
- Modify: `apps/web/src/features/admin/quest/components/QuizConfigSection.tsx`
- Modify: `apps/web/src/features/admin/quest/components/QuizReadinessList.tsx`
- Modify: `apps/web/src/i18n/{en,uz,ru}/adminQuest.ts`

**Interfaces:**
- Consumes: `checkReadiness(...)` (exists; returns the checks list), `QuizConfigForm`, `resizeQuizIds`.
- Produces: `QuizReadinessList` gains `collapsible` behaviour: a summary row (`✓ t.quiz.ready` or `⚠ t.quiz.toFix(n)`) that expands to the existing checklist.

- [ ] **Step 1: Default view.** When `config` is null or `distribution === 'single'`, show one `Select` labelled `t.quiz.quiz` ("Quiz") with the empty option `t.chooseQuiz`. Picking a quiz calls `set({ distribution: 'single', quizIds: [id] })`. Picking the empty option calls `set(null)` (this replaces the standalone Detach button).
- [ ] **Step 2: Split disclosure.** A quiet toggle/link `t.quiz.splitToggle` ("Give different groups different quizzes"). Local `useState`, initially `true` when the saved/current distribution is `parity` or `random`. When open, render the existing segmented control (Odd/even · Random groups only, no "One quiz" option), the stepper, the per-group selects and the group-size line. Closing it on a non-single config calls `set({ distribution: 'single', quizIds: config.quizIds.slice(0, 1) })` (see Review Focus).
- [ ] **Step 3: Readiness summary.** `QuizReadinessList` renders the one-line summary. It starts expanded when any check fails and `quizOpensAt` is within 24h of now, otherwise collapsed.
- [ ] **Step 4: Footer.** Merge `locksWhen` and the library link into one muted line: `t.quiz.locksAndLibrary` ("Locks when the quiz opens") followed by the `Link` "Manage quizzes →". Keep the `noQuizBanner` and lock banners as they are.
- [ ] **Step 5:** Update strings in en/uz/ru (new: `quiz`, `splitToggle`, `ready`, `toFix`, `locksAndLibrary`). Remove the ones no longer used (`detach`, `chooseSplit`, `distribution.single` if unused, `openLibrary`).
- [ ] **Step 6:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 7: Manual check.** A new quest shows a single select. Pick a quiz and save: it's stored as `single`. Open the split, choose Odd/even, pick two quizzes and save. Reload: the split opens expanded with both picks. Collapse it: it drops back to single with the first pick and the save bar appears. The readiness summary reads "Ready" / "N things to fix" and expands on tap. The locked state still disables everything with its banner.
- [ ] **Step 8: Commit**

```bash
git add apps/web/src
git commit -m "feat(admin): simpler quiz section — one quiz by default, split and checks tucked away"
```
