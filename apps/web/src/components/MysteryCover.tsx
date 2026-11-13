import { useT } from '@/i18n';

/**
 * The cover while an admin keeps the book a secret. Same `.cover` box as
 * `BookCover`, so callers swap one for the other. The real cover's sun disc
 * returns as a gold seal holding the `?`, tied with a ribbon: a wrapped
 * gift, not a missing image.
 */
export function MysteryCover() {
  const t = useT();
  return (
    <div className="cover cover--mystery" role="img" aria-label={t.book.mysteryLabel}>
      <div className="cover__frame" />
      <span className="mystery__ribbon mystery__ribbon--v" />
      <span className="mystery__ribbon mystery__ribbon--h" />
      <span className="mystery__seal">
        <span className="mystery__mark" aria-hidden="true">
          ?
        </span>
      </span>
      <span className="mystery__glint" />
      <div className="cover__sheen" />
    </div>
  );
}
