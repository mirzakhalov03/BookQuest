# App Shell Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorder the participant tabs, make pull-to-refresh work on every participant screen, and give Notifications a Telegram back button.

**Architecture:** Three small, independent web-only changes. The tab array in `TabBar.tsx` changes order. Screens opt into the existing global gesture via `usePullToRefresh()`. Notifications calls the existing `useTelegramBackButton`.

**Tech Stack:** React 19 + Vite + TypeScript, react-router, Zustand, Telegram WebApp SDK.

**Spec:** `docs/superpowers/specs/2026-11-12-app-shell-polish-design.md`

## Global Constraints

- No automated tests (project rule). Each task is verified with `pnpm typecheck` plus the manual check listed.
- Pull-to-refresh stays **off** on `/quiz/play`, `/me/welcome` and the admin quest/quiz editors.
- No new i18n strings.
- Manual checks run with `pnpm --filter @bookquest/web dev` (set `VITE_MOCK_API=true` if no API is running), on a narrow mobile viewport. Telegram-only behaviour is checked in Telegram on a real device.

## Review Focus

- A pull on Home while the 3D stage is mid-animation should refresh, not stick. Check on a real phone.
- Pulling on the quiz overview (`/quiz`) must refresh, but `/quiz/play` must only stretch.
- Opening `/notifications` from a bot deep link (no history), the back arrow must land on `/`, never close the app.
- The ≥900px floating tab pill must show the new order (DOM order drives it).
- A Prizes edition page (`/quests/2`) keeps the Prizes tab lit after the reorder.

---

### Task 1: Reorder the tab bar

**Files:**
- Modify: `apps/web/src/components/layout/TabBar.tsx` (`useTabs()` return array and its doc comment)

- [ ] **Step 1:** In `useTabs()`, return tabs in the order: `/` (stage), `/prizes` (with `alsoMatches: '/quests/'`), `/book`, the quiz/results conditional entry, `/me`. Update the doc comment's "fourth slot" sentence so it still describes the quiz/results swap (it stays 4th).
- [ ] **Step 2:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 3: Manual check.** At 390px wide, the tabs read Home · Prizes · Book · Quiz · Profile. At ≥900px, the floating pill shows the same order. On `/quests/1`, Prizes stays lit.
- [ ] **Step 4: Commit**

```bash
git add apps/web/src/components/layout/TabBar.tsx
git commit -m "feat(web): reorder tabs — Home, Prizes, Book, Quiz/Results, Profile"
```

### Task 2: Pull-to-refresh on every participant screen

**Files:**
- Modify: `apps/web/src/features/home/HomePage.tsx`
- Modify: `apps/web/src/features/book/BookPage.tsx`
- Modify: `apps/web/src/features/prizes/PrizesPage.tsx`
- Modify: `apps/web/src/features/prizes/QuestEditionPage.tsx`
- Modify: `apps/web/src/features/profile/ProfilePage.tsx`
- Modify: `apps/web/src/features/quiz/QuizPage.tsx`

**Interfaces:**
- Consumes: `usePullToRefresh(): void` from `@/hooks/usePullToRefresh` (exists).

- [ ] **Step 1:** Add `usePullToRefresh();` as the first hook call in each listed page component (before any early `return`, per the rules of hooks). In `ProfilePage`, put it in `ProfilePage` itself, not in `NotJoined`/sub-sections.
- [ ] **Step 2:** Confirm it is *not* called in `QuizPlayPage`, `SuccessScreen`, `QuestEditorPage`, `NewEditionPage` or `QuizEditorPage`: `grep -rn "usePullToRefresh()" apps/web/src` should list the 6 new pages plus the existing 5.
- [ ] **Step 3:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 4: Manual check (mobile emulation, then a real phone in Telegram).** On Home, Book, Prizes, Profile and `/quiz`, a pull from the top opens the book indicator, and releasing past the arm point turns pages and refetches (watch the network tab). On `/quiz/play`, a pull only stretches. If a page still won't refresh, follow the spec's §2 checklist (inner scroller / `window.scrollY`) and fix in that page's layout, not in `useOverscroll`.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features
git commit -m "fix(web): enable pull-to-refresh on Home, Book, Prizes, Profile and Quiz"
```

### Task 3: Telegram back button on Notifications

**Files:**
- Modify: `apps/web/src/features/notifications/NotificationsPage.tsx`

**Interfaces:**
- Consumes: `useTelegramBackButton(to: string): void` from `@/hooks/useTelegramBackButton` (exists).

- [ ] **Step 1:** Call `useTelegramBackButton('/');` at the top of `NotificationsPage`, next to `usePullToRefresh()`.
- [ ] **Step 2:** `grep -rLn "useTelegramBackButton" apps/web/src/features/*/*Page.tsx` and check each non-tab participant screen it lists. Per the spec, only Notifications is known to be missing. Add the hook to any other non-tab screen you find without one, pointing at its parent route.
- [ ] **Step 3:** Run `pnpm typecheck`. Expected: passes.
- [ ] **Step 4: Manual check in Telegram.** Open Notifications from the Home bell: the header shows a back arrow, not Close, and tapping it lands on Home. Open the Mini App straight onto `/notifications` (deep link): back still lands on Home. Leaving the page hides the arrow again.
- [ ] **Step 5: Commit**

```bash
git add apps/web/src/features
git commit -m "feat(web): Telegram back button on Notifications returns to Home"
```
