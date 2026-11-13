import type { Book } from '@bookquest/shared';
import { BookCover } from '@/components/BookCover';
import { MysteryCover } from '@/components/MysteryCover';
import { useT } from '@/i18n';

interface Book3DProps {
  /** `null` while the admin keeps the book a secret. */
  book: Book | null;
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
      aria-label={book ? t.home.bookAria(book.title, book.author) : t.book.mysteryLabel}
    >
      <div className="book__face book__cover">
        {book ? <BookCover title={book.title} author={book.author} coverUrl={book.coverUrl} /> : <MysteryCover />}
      </div>
      <div className="book__face book__spine">
        <span className="book__spinetext">{book ? book.title : '?'}</span>
      </div>
      <div className="book__face book__edge" />
      <div className="book__face book__top" />
      <div className="book__face book__back" />
    </div>
  );
}
