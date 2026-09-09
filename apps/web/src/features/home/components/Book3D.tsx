import { BookCover } from './BookCover';

interface Book3DProps {
  title: string;
  author: string;
  coverUrl: string | null;
}

/**
 * The book: five real faces held in 3D by `stage.css`'s `preserve-3d`, not an
 * illustration of one. Before touching any transform near this, read TRAP 1
 * and TRAP 2 in `stage.css` — the tilt has to stay positive (spine visible)
 * and the spine has to stay brighter than the cover (it faces the light).
 */
export function Book3D({ title, author, coverUrl }: Book3DProps) {
  return (
    <div className="book" role="img" aria-label={`${title} by ${author}, standing on a lit podium`}>
      <div className="book__face book__cover">
        <BookCover title={title} author={author} coverUrl={coverUrl} />
      </div>
      <div className="book__face book__spine">
        <span className="book__spinetext">{title}</span>
      </div>
      <div className="book__face book__edge" />
      <div className="book__face book__top" />
      <div className="book__face book__back" />
    </div>
  );
}
