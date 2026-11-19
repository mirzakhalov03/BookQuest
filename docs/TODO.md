# TODO

Future work, roughly in the order we expect to pick it up. Move an item into a spec/plan under `docs/superpowers/` when it starts.

**Shipped for launch (22 Nov 2026):** everything from the 2026-11-12 launch-prep specs (`docs/superpowers/specs/2026-11-12-*`).

**Specced on 2026-11-20:** every item below is covered by a spec in `docs/superpowers/specs/2026-11-20-*` and its plan in `docs/superpowers/plans/2026-11-20-*`:
account linking · book sources cards · prizes poster & profile · admin UX polish · certificate templates · bot refresh · refactor & optimization.

## Bugs

- **Duplicate accounts across sign-up paths.** Registered once in Telegram and once on bookquest.uz with the same name, phone and Telegram username → two participants (#3000 and #3002, both `@mirzakhalov03`). Signing in on the site didn't recognise the existing account. Accounts must be matched (Telegram ID / phone) and merged, not created twice.
- **Bot menu button doesn't open the mini app.** The CTA in the bottom-left corner of the bot chat does nothing — fix it. Also show the "Open" button next to the bot in the Telegram chat list.

## Participant app

### Books (`/book`)
- **"Where to get it" cards** (~100×300px each, four of them):
  1. **E-book**: where to find it online.
  2. **Movie**: where to watch the film adaptation. Redirects to YouTube after the user confirms.
  3. **Audiobook**: where to find the audio version.
  4. **Offline**: buy from HilolNashr's official partners and shops.
  
  Tapping a card opens a small dialog with clear steps (online or offline). Make them useful and polished.
- **Book cover and description:** higher-quality cover and add a book description.

### Prizes
- **Poster replaces the podium.** Remove the podium completely and add an image placeholder for this year's prize poster (we'll send the real one later).
- **Written prize list under the poster:** 1., 2., 3.… one prize per row.
- **Previous quests as accordions:** below that, one dropdown per past quest; opening it shows that quest's prize poster.

### Profile
- **Collapse the certificate section** when the user has no certificates yet.

## Admin

### Layout
- **Laptop navbar:** on desktop widths, show every link from the "More" menu right in the navbar.
- **Custom dropdowns everywhere:** replace every native `<select>` with a well-designed custom dropdown (starting with the quiz picker in the quest editor's quiz section).
- **Date picker icon:** make the calendar icon in date inputs white.

### Forms
- **Calmer validation:** no red errors on a fresh form. Only show required-field errors after a save attempt.
- **Creative placeholders** in all inputs, including the quiz title field.

### Quizzes (`/admin/quizzes/:id`)
- **Scroll to new question:** after "Add question", smooth-scroll so the new inputs land in view.
- **Remove up/down arrows** on questions. Drag-and-drop covers reordering, and we usually shuffle anyway.
- **Hide per-question time** in the questions list.

### Certificates
- **Upload new certificate templates.** Today there are only two: one for participation, one shared by all 5 ranks (only the rank text changes). Support uploading new designs to issue.

### Broadcast
- **Remove the "Announce the opening" button.**
- **Sent messages as a table:** a cleaner, table-like history with compact stats (e.g. `2/2` instead of "reached 2 out of 2 on Telegram").

## Bot

- **Premium emojis** in bot messages.
- **Refine copy**, starting with the intro message, and add a photo to the intro.

## Full refactor & optimization pass

A dedicated pass over the whole codebase (web + API, plus the bot). Start with an audit: bundle size and render performance on the web, query/N+1 and indexing on the API, duplicated logic, and structure against the conventions in the specs.
