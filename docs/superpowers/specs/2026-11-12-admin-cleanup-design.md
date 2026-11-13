# Admin cleanup — Design

**Goal:** a calmer admin for launch week. Drop what isn't used, simplify what's noisy, and let
pull-to-refresh do the job of the refresh buttons.

**Why now:** organisers will run the 22 November 2026 launch from their phones. Every extra control
is something to misread under pressure.

**Anti-goals:**
- Simplifying the quiz section so far that an admin can't set up odd/even or random groups when they
  need them, or can't see that the quiz *isn't ready* before it opens.
- Losing the "is this data fresh?" signal on the results page entirely while the quiz is live.

---

## 1. Results page header

`features/admin/ResultsInspectionPage.tsx` uses `AdminPageHeader` with the title ("Live
standings" / "Published {date}") and a `RefreshButton` in `actions` on the same row.

Change:
- **Title spans the full width.** The title gets its own row, with actions on the row below or
  floating top-right without squeezing it. Builder's call: either an `AdminPageHeader` prop
  (`stacked`) or a layout change everywhere if it looks better on every admin page. Check the
  other admin pages before choosing.
- **Sync button shrinks to an icon.** `RefreshButton` gets a compact mode: a 44×44 icon button
  (`RotateCw`, spins while fetching) with an `aria-label` of "Refresh", and no "Updated 14:02:31" text.
  Pull-to-refresh is already on for this page and becomes the main way to refresh. The icon is
  kept for desktop, where there's no pull gesture.
- Do the same on the other admin pages that use `RefreshButton` (Dashboard, Participants), so the
  admin is consistent. My call, since they share the component.

The background poll stays. The spinning icon is the "it's updating" signal.

## 2. Remove Posters from the dashboard

`DashboardPage.tsx` → `QUICK_ACTIONS` has a **Posters** tile ("Soon", no page behind it). Remove it,
its `actionPosters` key and its strings (en/uz/ru), and the `Image` icon import. With Certificates
getting a real page (see the Mascots & certificates spec), the row becomes **Quizzes · Certificates**.
Switch the grid to 2 columns.

## 3. Simplify the quiz section of the quest editor

`features/admin/quest/components/QuizConfigSection.tsx` today shows, at once: a 3-way
segmented control (One quiz / Odd-even / Random groups), a group count stepper, one select per
group, a group-size line, a Detach button, a readiness checklist (`QuizReadinessList`), a
"locks when…" note and a library link, plus up to two banners.

**Simpler default:**
- The section opens on **one quiz for everyone**: a single "Quiz" select ("Choose a quiz…") and
  nothing else. Picking a quiz attaches it with `distribution: 'single'`.
- **"Give different groups different quizzes"** is a quiet toggle/link under the select. Turning it
  on reveals the split control (Odd / even · Random groups) and its per-group selects, stepper and
  group-size line, exactly as today. If a saved quest already uses parity/random, it opens expanded.
- **Detach** becomes a small "Remove" action next to the select (or the empty option in the select).
  It's no longer a standalone button.

**Less noise:**
- `QuizReadinessList` collapses to **one status line**: ✓ "Ready" in green, or ⚠ "2 things to fix"
  in amber, which expands to the current checklist on tap. Problems stay one tap away. They're
  never removed.
- The "locks when the quiz opens" note and the library link merge into one muted line:
  "Locks when the quiz opens · Manage quizzes →".
- Banners: the red "no quiz yet and it's past open time" banner stays (it's an emergency). The lock
  banner stays (the section is read-only and needs to say why).

No data or API changes. `quizConfig` keeps its shape (`distribution` + `quizIds`).

---

## Out of scope
- The quiz library/editor pages (`/admin/quizzes`).
- Other quest editor sections (book changes are in the Book reveal spec, prizes in the Prizes spec).

## i18n
New and changed strings in `en`, `uz`, `ru`: the split toggle label, the readiness summary
("Ready" / "{n} things to fix"), the merged lock/library line, the refresh `aria-label`. Remove
the Posters strings and the "Updated {time}" string if nothing else uses it.
