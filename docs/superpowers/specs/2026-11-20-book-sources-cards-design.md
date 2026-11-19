# Book page: four "where to get it" cards — Design

**Goal:** `/book` answers "how do I actually get this book?" with four cards: **e-book**, **movie**,
**audiobook**, **buy offline** (HilolNashr's official partners and shops). Tapping a card opens a small
dialog with clear steps and the links. The book also gets a sharper cover and a real description.

**Today:** `ResourceList` shows two flat link lists ("Read or listen", "Where to find it"). Resource
kinds are `pdf | epub | audio | link | store`. There are no steps, no movie and no grouping a reader can scan.

**Anti-goals:**
- A card that opens to nothing. An empty category must look and behave differently.
- Leaving the app without warning. The movie card asks before jumping to YouTube.
- Admins typing the same steps every year if they don't change. (They can, but the defaults are sensible.)

---

## 1. Data

Add one resource kind: **`video`** (a film or adaptation, usually YouTube). `BOOK_RESOURCE_KINDS` →
`['pdf', 'epub', 'audio', 'link', 'store', 'video']`.

Cards map onto kinds, so no resource needs re-entering:

| Card | Kinds | Icon (lucide) |
|---|---|---|
| E-book | `pdf`, `epub`, `link` | `BookOpen` / `Tablet` |
| Movie | `video` | `Clapperboard` |
| Audiobook | `audio` | `Headphones` |
| Buy offline | `store` | `Store` |

Add per-card **steps** on the book: `book.guides: { ebook, movie, audio, offline }`, each `string | null`
(max 600 chars). The text is plain, and each line becomes a numbered step in the dialog. `null` uses the default steps
from i18n (e.g. offline: "1. Pick a shop below. 2. Ask for the book by title. 3. Show your participant number
for the partner discount." — the builder writes sensible defaults per card, without the discount line unless one exists).

The cover URL is unchanged. Book `description` already exists and stays as is.

## 2. The cards

- A 2×2 grid on desktop and a single column on phones. Each card is **~300px wide × 100px tall**.
  *My call on "100×300": wide, short rows read better on a 360px phone than four 100px-wide towers. Say so if you
  meant tall cards in a horizontal scroller.*
- Each card has its icon in a soft tinted tile, a title ("E-book"), a one-line hint ("3 places to read it") and a chevron.
  Each card has its own accent (ember / amber / sage / taupe from the existing palette). Use `frontend-design`.
- **Empty category:** dimmed, hint "Not available yet", not tappable, `aria-disabled`.
- Press feedback: scale 0.98 plus a light haptic (`Telegram.WebApp.HapticFeedback.impactOccurred('light')`
  where available, via `lib/telegram.ts`).

## 3. The dialog

Reuse `components/ui/Sheet.tsx` (bottom sheet on phones, centred on desktop).

- Header: icon, card title, then the book title as a subtitle.
- **Steps:** numbered list from `guides[card]` or the default.
- **Links:** one row per resource with the label, the domain in small text and an `ArrowUpRight`. They open with
  `openExternalLink` (same as today).
- **Movie:** each link is a button "Watch on YouTube". Tapping it swaps the sheet body to a confirm step:
  "You're leaving BookQuest to watch on YouTube." with **Open YouTube** / **Stay**. Only then does it open.
  (The sheet itself is the confirmation, with no second dialog stacked on top.)
- **Offline:** stores list as today. If the label contains an address, it's shown as given. No maps in v1.

## 4. Admin

`ResourceListEditor` offers the new kind ("Movie / video"). `BookFieldsSection` gets a small "Card steps"
group: four optional textareas (one per card) with the default steps as the placeholder, so the admin sees what readers
get if it's left empty.

## 5. Cover and description (content + one quality fix)

- **Content (organisers, in admin):** upload a high-resolution cover (≥1200px tall source) and write the book
  description. It's a data task with no code needed.
- **Quality:** `ImagePicker` downscales covers to 1000px longest side at WebP 0.82. The 3D book on Home renders larger
  than the 200px thumbnail on retina screens. Raise **covers only** to 1600px and quality 0.9. Prize posters keep
  their own setting.

---

## Out of scope
- Prices, stock and maps for shops.
- Embedded video playback.
- Per-link descriptions.

## i18n
`en`, `uz`, `ru`: four card titles, hints ("N places", "Not available yet"), default steps per card, dialog
headings, the YouTube confirm copy and buttons, the new kind label, the admin "Card steps" labels and hints.
