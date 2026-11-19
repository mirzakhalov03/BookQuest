# Uploadable certificate designs — Design

**Goal:** organisers upload the real certificate artwork in admin, and every issued certificate uses it.
There are **two designs**:
1. **Participation:** everyone who finished but isn't in the top 5.
2. **Winner:** one design shared by **ranks 1–5**. Only the rank text printed on it changes.

**Today:** `apps/api/src/certificates/template.tsx` is placeholder art drawn in satori, with four tiers
(`gold | silver | bronze | participant`, ranks 1–3 only, `certificateTier` in shared). `IS_PLACEHOLDER_ART = true`
shows a note on the admin Certificates page.

**Anti-goals:**
- A name printed off-centre or over the artwork's ornaments, or overflowing on long or Cyrillic names.
- Breaking already-sent certificates' verification links (`/verify/:code` and `…/image.png` must keep working).
- A design upload instantly changing certificates people already downloaded without anyone noticing. The admin sees a
  preview before it's live.

---

## 1. Tiers: winner (1–5) and participant

- `CERTIFICATE_TIERS = ['winner', 'participant']`. `certificateTier(rank)` returns `{ placing: rank, tier: 'winner' }`
  for ranks **1–5**, otherwise `{ placing: null, tier: 'participant' }`. `CertificatePlacing = 1 | 2 | 3 | 4 | 5`.
- Prizes already go to 5th place (shipped in `63c9dbc`), so certificates now match.
- The web (Profile `Certificate`, `/verify`, admin previews) reads `placing` for the rank label. Anything keyed on
  gold/silver/bronze moves to `placing` (e.g. an accent per place can stay as a small badge colour).

## 2. Storing the designs

- Two images per **quest**: `quest.certificateDesigns: { participant: fileId | null, winner: fileId | null }`.
- Stored in GridFS like covers (a new bucket `certificate-designs`, with the same upload pipeline and validation as
  `cover.services.ts`: PNG or JPEG, ≤8 MB, landscape A4 ratio within ±3%, min 2246px wide since the render is 2× 1123).
- Uploaded **without** downscaling (the admin `ImagePicker` gets a `noDownscale` option for this).
- No design uploaded → the current placeholder art is used for that tier, so nothing breaks before the art arrives.

## 3. Rendering on top of the artwork

`render.ts` keeps satori + resvg. `template.tsx` becomes: the uploaded image as a full-bleed background `<img>`
(base64 data URI read from GridFS, cached in memory per file id), plus text layers positioned on top:

| Layer | Participant | Winner |
|---|---|---|
| Full name | ✓ | ✓ |
| Rank line ("1-o‘rin", "2-o‘rin" … "5-o‘rin") | — | ✓ |
| Book title + edition/year | ✓ | ✓ |
| Certificate code + QR (verify link) | ✓ | ✓ |

- **Positions** live in one config object per tier, `LAYOUT: Record<CertificateTier, LayerBoxes>`, with boxes in
  layout pixels (1123×794). They're tuned once the real art is in hand, and it's a code change because the art changes about once a year.
  *My call: no drag-to-position editor in v1.*
- Name size keeps stepping down by length (existing `nameSize`), and Cyrillic uses the loaded Noto Sans fallback.
- Text colour per tier comes from the config (dark on light art by default).
- **Cache keys** include the design file id, so uploading a new design re-renders automatically, and `TEMPLATE_VERSION` gets bumped once.

## 4. Admin Certificates page

- A "Designs" section with two cards, **Participation** and **Winner (1st–5th)**. Each has an upload or replace button, the current
  image thumbnail, and a **preview** rendered with a sample name (the existing fixed samples, extended with a rank 4
  winner and a long name).
- Replacing a design asks first: "Certificates already sent will show the new design the next time they're opened.
  Continue?"
- The "placeholder art" note shows per tier while that tier has no upload.
- The Results page no longer shows sample certificates (already done in `b4f812c`; check).

---

## Out of scope
- More than two designs, per-rank designs, or a visual layout editor.
- Changing what's printed (fields stay as listed).

## i18n
`en`/`uz`/`ru` admin copy: section and card titles, upload/replace, the replace confirm, and a validation error ("Use a
landscape A4 image at least 2246px wide"). Rank lines on the certificate itself are Uzbek (the certificate's language), like
today's template.
