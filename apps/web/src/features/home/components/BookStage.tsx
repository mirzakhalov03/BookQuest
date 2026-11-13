import type { Book } from '@bookquest/shared';
import { Spotlight } from './Spotlight';
import { Motes } from './Motes';
import { Book3D } from './Book3D';
import { Podium } from './Podium';

interface BookStageProps {
  book: Book | null;
}

/** The `.stage__center` column: spotlight, dust, the book, and what it stands on. */
export function BookStage({ book }: BookStageProps) {
  return (
    <div className="stage__center">
      <Spotlight />
      <Motes />

      <div className="bookwrap">
        <Book3D book={book} />
        {/* The book's contact shadow — negative z-index, still inside the
            isolated stacking context `.stage__center` creates. */}
        <div className="book__contact" aria-hidden="true" />
      </div>

      <Podium />
    </div>
  );
}
