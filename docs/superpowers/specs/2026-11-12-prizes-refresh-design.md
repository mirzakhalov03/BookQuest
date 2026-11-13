# Prizes refresh — Design

**Goal:** make the prizes the reason people join. Five places win something, past editions show what
was given, Home points people at the prizes, and the page can show a real photo of the prizes.

**Why now:** the 22 November 2026 launch. Prizes are the strongest hook for a new reader, and today
they sit on the 4th tab with no way in from Home.

**Anti-goals:**
- An empty or "To be announced" prize list being pushed from Home. The CTA only appears when
  there's something to show.
- 4th and 5th place feeling like an afterthought (tiny grey text under a big podium).
- A past edition's card turning into a wall of text.

---

## 1. Prizes for 4th and 5th place

`prizesSchema` (`packages/shared/src/schemas/quest.ts`) gains two nullable fields:

```ts
fourth: z.string().nullable(),
fifth: z.string().nullable()
```

Follow-through:
- Quest model (`apps/api/src/models/quest.model.ts`) and `toQuestDto` (`prizes.fourth ?? null`, …).
  Existing documents read as `null`, so no migration is needed.
- Create/update validators (`apps/api/src/validators`) accept the new fields.
- Admin form: `PrizeFieldsSection.tsx` gets two more inputs. `questForm.ts`, `questFormSchema.ts`,
  `changes.ts` and `review.ts` (the review-changes labels) all handle `fourth`/`fifth`.
- `hasAnyPrize` (in `PrizePodium.tsx`) checks all five. Move the place list (`PLACES`) somewhere
  shared by the podium, the list and the archive, so "the five places" is defined once.
- Certificates are unchanged: gold/silver/bronze stay for 1–3, and 4th and 5th get the participant tier.

## 2. Prize photo (optional) with podium fallback

The admin can upload **one photo of all the prizes** (e.g. laid out on a real podium).

- Quest model: `prizesPhotoUrl: string | null`. Public DTO: `prizes.photoUrl`.
- Upload reuses the cover upload pipeline (`cover.services.ts`, `upload.middleware.ts`,
  `useUploadCover`, `CoverPicker`). Builder's call whether to generalise that into an "image
  upload" or add a sibling route. Don't duplicate the processing code.
- Admin: a photo picker at the top of `PrizeFieldsSection` with an "Add a photo of the prizes"
  empty state and remove/replace.

**Prizes page (`CurrentPrizes`) layout:**

| Photo uploaded? | Layout |
|---|---|
| Yes | The photo full-width (rounded, with the edition label over its bottom edge), then a **ranked list of places 1–5** below it: rank numeral, place label, prize text. 1–3 tinted gold/silver/bronze. |
| No | The current **podium** for 1–3 (`PrizePodium`, unchanged), then **4th and 5th as compact rows** under it, styled like the ranked list rows, so it doesn't look like a different system. |

Places with no prize: in the list, omit 4th/5th when null. 1–3 keep "To be announced" (as the
podium does today).

## 3. Previous quests show their prizes

`PreviousQuests` / `QuestSummaryCard` already list past editions with book and winner. Add what was given:

- `questSummarySchema` gains `prizes: prizesSchema` (or the subset the card needs). `toQuestSummary`
  fills it. It's already loaded from the same document, so there's no extra query.
- The card shows a single compact line under the reader count, e.g. `🏆 AirPods Pro · Kindle · 500 000 so'm`,
  1st → 3rd, truncated to one line. My call: only 1–3 on the card. The full five live on the edition
  page (`QuestEditionPage`), which should show the prize list too.
- The section stays visually secondary to the current prizes: smaller heading (`type-label`),
  thumbnails as today. The user asked for "smaller section".

If a past edition has no prizes recorded, the line is omitted.

## 4. Home → Prizes CTA

A tappable card on Home (`features/home/HomePage.tsx`), placed under `QuestAction`:

- Shows the **1st prize** as the hook ("Win AirPods Pro"), with a small "+4 more prizes" line
  (count of non-null places minus one), a trophy icon, and an arrow. With a prize photo, show it as a
  small thumbnail on the card.
- Taps through to `/prizes` with a light haptic (`haptic('select')`).
- **Hidden when no prize is set** (`hasAnyPrize` false) and in the `finished` phase (the results
  matter more then).
- Visual weight: clearly secondary to `QuestAction` (which is the primary action) but warmer than a
  plain link. Brand orange/gold accent, a subtle shine or shimmer once on first paint. The builder
  designs it with `frontend-design`.

---

## Out of scope
- Sponsors/logos per prize, prize images per place.
- Ranking or scoring changes. The results board stays the same.

## i18n
New strings in `en`, `uz`, `ru`: 4th/5th place labels (and ordinals if `ordinal.ts` doesn't cover
them), admin photo picker copy, the CTA ("Win {prize}", "+{n} more prizes"), the archive prize line's
accessible label.
