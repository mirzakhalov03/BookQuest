# App shell polish — Design

**Goal:** three small fixes to the frame every participant screen sits in, ready before the
**22 November 2026 launch**: the tabs in the right order, pull-to-refresh that works everywhere,
and a way back from Notifications inside Telegram.

**Why now:** the demo data is being wiped for launch. These are the first things a new reader
touches, and two of them currently feel broken.

**Anti-goals:**
- Pull-to-refresh firing on a screen where a reload would lose work (quiz play, admin forms).
- A back button that drops the reader out of the Mini App instead of landing on Home.

---

## 1. Tab order

`components/layout/TabBar.tsx` → `useTabs()` today returns: Stage, Book, Quiz/Results, Prizes, Profile.

New order:

| Slot | Tab | Notes |
|---|---|---|
| 1 | Home (`/`, label `nav.stage`) | unchanged |
| 2 | Prizes (`/prizes`, also lit on `/quests/*`) | moved up from slot 4 |
| 3 | Book (`/book`) | moved down from slot 2 |
| 4 | Quiz → Results (`/quiz` until `resultsAt`, then `/results`) | the swap logic stays as is |
| 5 | Profile (`/me`) | unchanged |

Only the array order changes. Update the doc comment ("the fourth slot…") so it still says the
right thing. The ≥900px floating-pill layout (`styles/stage.css`) renders in DOM order, so it
picks up the change too. Check it at desktop width.

## 2. Pull-to-refresh on every participant screen

**Diagnosis (from the code, 2026-11-12):** the gesture is global (`hooks/useOverscroll.ts`, mounted
in `AppLayout`), but a pull only *refreshes* when a screen has opted in by calling
`usePullToRefresh()`. Only five screens opt in: `NotificationsPage`, `ResultsPage`, and the admin
`DashboardPage`, `ParticipantsPage` and `ResultsInspectionPage`. On Home, Book, Prizes, Profile and the quiz
overview, a pull just stretches the page and springs back. That matches the report "pull to refresh
is not working".

**Fix:** call `usePullToRefresh()` at the top of:
- `features/home/HomePage.tsx`
- `features/book/BookPage.tsx`
- `features/prizes/PrizesPage.tsx` and `features/prizes/QuestEditionPage.tsx`
- `features/profile/ProfilePage.tsx`
- `features/quiz/QuizPage.tsx` (the overview only)

**Keep it off:** `/quiz/play` (a refetch mid-question must not happen), `/me/welcome`, and the admin
quest/quiz editors (unsaved forms).

**Verify on a real device in Telegram (iOS and Android)** before calling it fixed. If it still fails
on a screen that has opted in, look next at:
1. `atTop()` uses `window.scrollY`. Confirm the document is the scroller on that screen and not an
   inner `overflow: auto` box. `canStretch()` deliberately bails on scrollable ancestors.
2. `disableVerticalSwipes()` (in `lib/telegram.ts`) needs Bot API 7.7+. On older clients, Telegram
   swallows the downward swipe to minimise the sheet. Nothing to fix there; just know it's expected.

**Builder's call:** whether to collapse this into "on by default, opt *out*" (a route list in
`AppLayout`) instead of per-screen calls. Recommended only if it stays one obvious list.

## 3. Back button on Notifications

`features/notifications/NotificationsPage.tsx` never calls `useTelegramBackButton`, so inside
Telegram the only control in the header is the native **Close**, which quits the Mini App.

**Fix:** `useTelegramBackButton('/')` at the top of `NotificationsPage`. The hook already exists
(`hooks/useTelegramBackButton.ts`) and replaces Close with Telegram's native back arrow while the
screen is mounted. It navigates to an explicit route, not `navigate(-1)`, so it works when
Notifications was opened from a bot deep link.

Outside Telegram, the hook does nothing. **My call:** no in-page back link on the web. The tab bar is
there, and Notifications isn't a tab.

**Check while here:** any other non-tab screen without the hook. Currently known: Notifications only.

---

## Out of scope
- Changing the refresh mechanism (refetch vs. full reload). Refetch stays.
- Desktop/web back navigation beyond what the tab bar gives.

## i18n
No new strings.
