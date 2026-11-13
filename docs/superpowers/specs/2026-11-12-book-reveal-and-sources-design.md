# Book reveal & where to find it — Design

**Goal:**
1. Admins can **hide the book** when a quest is announced, so the book itself is the reveal. Every
   place shows a `?` cover and `/book` is locked until an admin flips it back.
2. Readers can see **where to get the book** (shops, libraries, online stores), not just the
   PDF/EPUB/audio links that exist today.

**Why now:** the 22 November 2026 launch is an announcement. The intrigue only works if the book
stays secret until the organisers choose to reveal it.

**Anti-goals:**
- The book leaks while hidden: in an API response, a cover URL, a bot message, a page title, or
  the network tab. A `?` drawn over a cover that's already in the payload is a failure.
- Hiding the book blocks anything else: registration, the countdown and prizes keep working.
- Readers hit a broken or empty `/book` with no explanation.

---

## 1. Data

On the quest model (`apps/api/src/models/quest.model.ts`):

```ts
bookRevealed: { type: Boolean, default: true }
```

- **Existing quests** read as revealed (the default), so nothing changes for past editions.
- **New editions** (`NewEditionPage` → `createQuest`): **my call:** the form starts with *Hidden*
  selected. Launches are announcements, so hidden is the safer default. The admin can flip it before saving.

Shared schema (`packages/shared/src/schemas/quest.ts`):

```ts
// Public quest
bookRevealed: z.boolean(),
book: bookSchema.nullable(),   // null while hidden
```

`AdminQuest` always carries the full `book` plus `bookRevealed`. The admin needs to edit it while
it's hidden.

## 2. Server: hide at the source

`toQuestDto` in `apps/api/src/services/quest.services.ts` is the single place a public quest is
built. When `bookRevealed === false` it returns `book: null`. Title, author, pages, cover,
description and resources are all withheld.

Also covered:
- **`toQuestSummary`** (archive): only relevant if a hidden quest is ever past. My call: hidden
  quests are never listed in the archive, since the archive only holds non-current editions.
  Add an assertion or filter so it can't happen by accident.
- **`GET /covers/:id`**: a cover id that's never sent can't be fetched, so no extra guard is needed.
  Check that no other endpoint returns the cover URL of the current quest.
- **Bot:** checked 2026-11-13: `apps/bot` never reads the quest's book (its client only upserts
  users and records interactions), so no bot change is needed.
- **Certificates and results** only exist after the quiz, by which time the book is revealed. No change.

## 3. Admin toggle

In the quest editor (`features/admin/quest/QuestEditorPage.tsx`), at the top of the **Book**
section (`BookFieldsSection`):

- A `Switch` (exists: `components/ui/Switch.tsx`) labelled **"Show the book to readers"**, with a
  one-line hint: "Off: readers see a ? cover and /book stays locked. Use it to keep the book a
  surprise until you announce it."
- It saves through the normal save bar and review-changes sheet like every other field, so
  "Revealed the book" / "Hid the book" appears in the review list.
- **Revealing is a moment.** My call: no push or broadcast is sent automatically. The admin
  announces it through Broadcast. The review sheet shows a one-line nudge after revealing: "Readers
  will see the book on their next refresh. Want to announce it?" with a link to `/admin/broadcast`.
- The editor's live preview (`QuestPreview`) shows the hidden state while the switch is off.

The dashboard quest card shows a small "Book hidden" chip while it's hidden, so admins don't forget.

## 4. Participant side while hidden

| Place | Hidden state |
|---|---|
| Home stage (`BookStage` / `Book3D`) | The 3D book renders with a **mystery cover**: the usual cover frame with a large `?` and no title or author. The side panels (`StageAside`) show "Revealed soon" in place of title/author/pages. Countdown and `QuestAction` unchanged. |
| `/book` (`BookPage`) | A locked screen: the mystery cover, "The book is a secret, for now", "We'll reveal it soon. You'll get a notification." No resources, no description. |
| Tab bar | The Book tab stays, with a small lock badge on the icon. It still navigates (to the locked screen). |
| Prizes / anywhere `quest.book` is read | Handle `book: null`. Don't render a broken cover. |
| Page `<title>` / share text | No book title. |

**The mystery cover** is one component (`components/BookCover.tsx` gets a `mystery` variant,
or a sibling `MysteryCover`), reused by the stage, `/book` and the editor preview. It should
feel like a sealed gift, not a missing image: the brand palette, a large `?` set in the display
face, and a slow shimmer or gentle float to fit the stage's existing motion (`Motes`, `Spotlight`).
The builder designs it with `frontend-design`. Sans display, no serif.

When the reveal happens, a reader on Home sees the real cover on their next refetch (pull-to-refresh
or the stale-time refresh). **Nice to have, builder's call:** a one-time flip or reveal animation
the first time a reader sees the real cover after having seen the `?` (remembered in
`localStorage`, wrapped in try/catch).

## 5. Where to find the book

Today: `bookResourceSchema` has `kind: 'pdf' | 'epub' | 'audio' | 'link'`, edited in
`ResourceListEditor`, shown in `features/book/components/ResourceList.tsx`.

Change:
- Add one kind, **`'store'`**, to `BOOK_RESOURCE_KINDS` (`packages/shared/src/constants/quest.ts`).
  It means anywhere to buy or borrow the book: a bookshop, an online store, a library. The label
  carries the name ("Asaxiy", "Alisher Navoiy library").
- `/book` shows two groups:
  1. **Read or listen**: pdf, epub, audio, link (as today)
  2. **Where to find it**: store links, with a store/map-pin icon in `ResourceIcon`

  A group with no items is not rendered.
- `ResourceListEditor` offers the new kind in its select ("Shop or library").

My call: stores stay links (http/https, same validation). No addresses, maps or prices in v1.
A physical shop gets a Google Maps or website link.

---

## Out of scope
- Scheduled auto-reveal at a set time (manual toggle only).
- Hiding anything other than the book (prizes, dates).
- Teaser hints while hidden ("a classic from the 1960s").

## i18n
All new strings in `en`, `uz`, `ru`: the switch and its hint, the review-sheet lines and nudge, the
dashboard chip, the locked `/book` copy, "Revealed soon", the bot line, the "Where to find it"
heading and the "Shop or library" kind label.
