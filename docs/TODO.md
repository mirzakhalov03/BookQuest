# TODO

Future work, roughly in the order we expect to pick it up. Move an item into a spec/plan under `docs/superpowers/` when it starts.

**Launch prep (22 Nov 2026), specced on 2026-11-12** in `docs/superpowers/specs/2026-11-12-*`: app shell polish, book reveal & sources, prizes refresh, mascots & certificates, admin cleanup. Every item below is covered by one of them.

## Bugs

- **Pull-to-refresh isn't working.** Shipped in `46a8b69` but the gesture doesn't trigger a refresh — needs debugging.

## Participant app

### Navigation
- **Reorder the navbar:** Home → Prizes (Sovrinlar) → Books → Results.
- **Notifications back button:** when the notifications section is open, turn Telegram's native "Close" button into a back button that returns to Home.

### Home
- **Prizes CTA:** add an eye-catching button on Home that pulls users into the Prizes section.

### Prizes
- **Possible redesign (undecided):** drop the podium entirely and show a single photo of all the prizes already standing on a real podium.
- **Prizes for 4th and 5th place**, not just the top 3.
- **Previous quests section:** a smaller section showing what prizes were given in past quests.

### Books
- **Where to find the book:** add reference links (stores, libraries, etc.).

### Profile
- **Avatar picker:** remove the 3rd mascot.
- **Randomly assigned mascots:** give each user a random mascot by default, and animate it when they open Profile so they notice it.

### Certificates
- **Redesign the certificates section.**

## Admin

- **Hide/reveal the book toggle:** when hidden, the book cover shows a `?` and the `/book` section is locked. Used when a quest is announced, to keep the intrigue.
- **Results page:** title spans full width; the Sync button gets smaller and drops the "last synced" time — pull-to-refresh replaces it.
- **Real certificate designs:** put the actual certificate designs in the dashboard's Certificates section, and remove the sample ones from the Results page.
- **Remove the Posts section** from the dashboard.
- **Simplify the quiz section** of the quest editor.

## Full refactor & optimization pass

A dedicated pass over the whole codebase (web + API). Not scoped yet — start with an audit: bundle size and render performance on the web, query/N+1 and indexing on the API, duplicated logic, and structure against the conventions in the specs.
