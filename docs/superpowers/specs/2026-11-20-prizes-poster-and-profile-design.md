# Prizes poster & quieter certificates — Design

**Goal:**
1. The Prizes tab leads with **one poster** of this year's prizes (we'll send the real one later), a written
   1–5 list under it, and past quests as **accordions**, each opening to that quest's poster.
2. Profile's certificate section **shrinks** when the reader has no certificate.

**Today:** `PrizeShowcase` shows the photo + list when `prizes.photoUrl` is set, otherwise the podium + 4th–5th
rows. `PreviousQuests` lists `QuestSummaryCard` links to `/quests/:edition`. Profile always shows a
full-size `CertificateTeaser` (a fake certificate sheet) or a "missed" line.

**Anti-goals:**
- A blank grey box that looks broken while the poster isn't uploaded yet.
- Past quests losing the way into their full edition page.
- The profile feeling empty. Smaller doesn't mean gone.

---

## 1. Current prizes

- **The podium is removed completely.** `PrizePodium.tsx` is deleted (it's only used by `PrizeShowcase`; `ResultsPodium` is a
  different component and stays).
- **Poster** (`prizes.photoUrl`, the existing field, renamed in copy only to "poster"): shown at its natural ratio,
  rounded, full width, tap to open full-screen (reuse whatever `PrizePhoto` does today).
- **Placeholder** while `photoUrl` is null: a portrait (4:5) frame in the brand palette with a soft
  gradient, a trophy glyph and "The prize poster is coming soon". It should feel deliberate, like a poster still
  under wraps. It's the same family as `MysteryCover`. Use `frontend-design`.
- **Written list under it:** `PrizeList` from place 1 to 5, **one prize per row**: `1.  Kindle Paperwhite`.
  Empty places are skipped. If all five are empty, show the existing "not announced yet" copy instead of the list.

## 2. Previous quests as accordions

Each past edition is one accordion row:
- **Closed:** the edition label ("2025 · 2nd edition"), the book title, and a chevron.
- **Open:** that quest's prize poster (`summary.prizes.photoUrl`, already on `QuestSummary`) or, without one, its
  written 1–3 list. Then a quiet link, "See the full edition →", to `/quests/:edition` (the existing page).
- One open at a time. The open/close height animation respects reduced motion. The panel is a `region` with an
  `aria-labelledby` pointing at its header button (`aria-expanded`).
- "Load more" stays.

`QuestSummaryCard` is replaced by `PastQuestAccordion`. Check nothing else imports the card before deleting it.

## 3. Profile certificate section

| State | Today | New |
|---|---|---|
| Certificate exists | `Certificate` | unchanged |
| No certificate, results not out | full-size teaser sheet | **one compact row**: lock icon, "Your certificate unlocks when results are out", date on a second line. ~64px tall. |
| Results out, none earned | a text line | same compact row style, with the existing "missed" copy |

`CertificateTeaser` becomes the compact row (the CSS `.cert-teaser__sheet` block goes).

---

## Out of scope
- Multiple posters per quest, or a gallery.
- Admin changes. The poster upload already exists as the prize photo in the quest editor; only its label changes to "Prize poster".

## i18n
`en`/`uz`/`ru`: placeholder copy, "See the full edition", the compact certificate line, and the admin label rename
("Prize photo" → "Prize poster").
