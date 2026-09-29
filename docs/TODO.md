# TODO

Future work, roughly in the order we expect to pick it up. Move an item into a spec/plan under `docs/superpowers/` when it starts.

## Pull-to-refresh

Pull down from the top of a screen; a circular book indicator fills as you drag, and reaching the threshold reloads the page.

Findings from looking at the code (2026-09-29):

- **No book loader exists yet.** The only loading UI is `components/ui/Spinner.tsx` (plain ring) and `LoadingState`. `.book` in `styles/stage.css` is the 3D hero book, not a loader. The fill-circle book indicator has to be built new (SVG ring + book icon driven by `progress`), styled to match Spinner/tokens.
- **Telegram fights the gesture.** A downward swipe collapses/closes the Mini App. Add a feature-detected `disableVerticalSwipes()` to `lib/telegram.ts` (same try/catch guard as `enableClosingConfirmation`).
- **Native browser pull-to-refresh** would double-fire; add `overscroll-behavior-y: contain`.
- **Exclude admin routes.** A reload wipes half-edited quest forms (see `useUnsavedChangesGuard`).
- **Trigger** fires when the ring completes (haptic tick at full), per the request; releasing early snaps back with no reload.
- **Reload vs refetch:** `window.location.reload()` also picks up a new service-worker build; `queryClient.invalidateQueries()` is smoother (no flash, keeps scroll/state). Default to reload unless we decide otherwise.
- Planned files: `hooks/usePullToRefresh.ts`, `components/ui/PullToRefresh.tsx`, mounted once in `layouts/AppLayout.tsx`.
- Open: no design approval yet — confirm the admin exclusion and reload-vs-refetch before building.

## Quiz-making feature

Let admins author the quiz for a quest's book. Not scoped yet — needs brainstorming (question types, editor UX, how it ties to editions and results).

## Full refactor & optimization pass

A dedicated pass over the whole codebase (web + API). Not scoped yet — start with an audit: bundle size and render performance on the web, query/N+1 and indexing on the API, duplicated logic, and structure against the conventions in the specs.
