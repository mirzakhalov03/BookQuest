import { BookCover } from './BookCover';
import { formatCount, formatOrdinalEdition } from '@/lib/format';

interface BookHeroProps {
  /** Omitted where the edition is already implied, e.g. `/book` is always the current one. */
  edition?: number;
  year?: number;
  title: string;
  author: string;
  pages: number;
  coverUrl: string | null;
  titleAs?: 'h1' | 'h2';
}

/**
 * The cover plus the facts that identify a book at a glance — shared by
 * `/book` (the current edition) and `/quests/:edition` (a past one), which
 * show the exact same shape of information about two different quests. Lives
 * here rather than in either feature because both need it (spec §4 rule 1).
 */
export function BookHero({ edition, year, title, author, pages, coverUrl, titleAs: Title = 'h1' }: BookHeroProps) {
  return (
    <header className="flex items-start gap-5">
      <div className="cover-box">
        <BookCover title={title} author={author} coverUrl={coverUrl} />
      </div>

      {/* `min-w-0` stops a long title widening the screen; `@container` lets
          the title size itself to this column instead of breaking words. */}
      <div className="@container flex min-w-0 flex-1 flex-col gap-2 pt-1">
        {edition !== undefined && year !== undefined && (
          <p className="type-label">
            {formatOrdinalEdition(edition)} edition · {year}
          </p>
        )}
        <Title className="type-display text-[clamp(1.25rem,13cqi,1.75rem)] text-paper">{title}</Title>
        <p className="text-taupe">{author}</p>
        <p className="text-sm text-taupe-dim">{formatCount(pages)} pages</p>
      </div>
    </header>
  );
}
