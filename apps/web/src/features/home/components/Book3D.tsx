import type { Book } from '@bookquest/shared';
import { BookCover } from '@/components/BookCover';
import { useT } from '@/i18n';

interface Book3DProps {
  /** The revealed book. While it's a secret, the stage shows `SealedTome` instead. */
  book: Book;
}

/**
 * The book: five real faces held in 3D by `stage.css`'s `preserve-3d`, not an
 * illustration of one. Before touching any transform near this, read TRAP 1
 * and TRAP 2 in `stage.css` — the tilt has to stay positive (spine visible)
 * and the spine has to stay brighter than the cover (it faces the light).
 */
export function Book3D({ book }: Book3DProps) {
  const t = useT();
  return (
    <div
      className="book"
      role="img"
      aria-label={t.home.bookAria(book.title, book.author)}
    >
      <div className="book__face book__cover">
        <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} />
      </div>
      <div className="book__face book__spine">
        <span className="book__spinetext">{book.title}</span>
      </div>
      <div className="book__face book__edge" />
      <div className="book__face book__top" />
      <div className="book__face book__back" />
    </div>
  );
}
