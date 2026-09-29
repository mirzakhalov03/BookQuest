interface BookCoverProps {
  title: string;
  author: string;
  /** `book.coverUrl` — a real photograph when an admin has set one, `null` for the seeded quest. */
  coverUrl: string | null;
}

/**
 * The cover face. The frame, sun, dune and sheen are frontend-owned and
 * static (spec §11) — an abstract desert horizon that stands in for any book,
 * not an illustration of this one. Title and author are backend-owned text
 * laid over it.
 *
 * When `coverUrl` is set, a real photograph replaces the whole illustration
 * rather than sitting inside it: a photographed cover already carries its
 * own title and author lettering, so drawing ours on top would duplicate it
 * and fighting an arbitrary image's own composition besides. The sheen stays
 * — it is the stage's lighting hitting the object, not part of the cover's
 * content, so it belongs over a photo exactly as much as over the drawing.
 */
export function BookCover({ title, author, coverUrl }: BookCoverProps) {
  if (coverUrl) {
    return (
      <div className="cover">
        <img className="cover__image" draggable={false} src={coverUrl} alt={`${title} cover`} />
        <div className="cover__sheen" />
      </div>
    );
  }

  return (
    <div className="cover">
      <div className="cover__frame" />
      <div className="cover__sun">
        <span className="cover__rays" />
        <span className="cover__disc" />
      </div>
      <div className="cover__dune" />
      {/* The prototype hand-breaks "The<br>Alchemist" — a title chosen for that
          exact break. A backend-owned title can be any length, so this wraps
          naturally inside the fixed cover box instead of guessing a line. */}
      <p className="cover__title">{title}</p>
      <p className="cover__author">{author}</p>
      <div className="cover__sheen" />
    </div>
  );
}
