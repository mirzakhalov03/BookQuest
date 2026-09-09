import { BookCover } from './BookCover';
import { formatCount, formatOrdinalEdition } from '@/lib/format';

interface BookHeroProps {
  edition: number;
  year: number;
  title: string;
  author: string;
  pages: number;
  coverUrl: string | null;
}

/**
 * The cover plus the facts that identify a book at a glance — shared by
 * `/book` (the current edition) and `/quests/:edition` (a past one), which
 * show the exact same shape of information about two different quests. Lives
 * here rather than in either feature because both need it (spec §4 rule 1).
 */
export function BookHero({ edition, year, title, author, pages, coverUrl }: BookHeroProps) {
  return (
    <header className="flex items-start gap-5">
      <div className="cover-box">
        <BookCover title={title} author={author} coverUrl={coverUrl} />
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-1">
        <p className="type-label">
          {formatOrdinalEdition(edition)} edition · {year}
        </p>
        <h1 className="type-display text-3xl text-paper">{title}</h1>
        <p className="text-taupe">{author}</p>
        <p className="text-sm text-taupe-dim">{formatCount(pages)} pages</p>
      </div>
    </header>
  );
}
