import type { Book } from '@bookquest/shared';
import { Spotlight } from './Spotlight';
import { Motes } from './Motes';
import { Book3D } from './Book3D';
import { SealedTome } from './SealedTome';
import { Podium } from './Podium';
import { useBookRig } from '../hooks/useBookRig';
import { useTomeFx } from '../hooks/useTomeFx';

interface BookStageProps {
  book: Book | null;
}

/** The `.stage__center` column: spotlight, dust, the book, and what it stands on. */
export function BookStage({ book }: BookStageProps) {
  const hidden = book === null;
  const fx = useTomeFx(hidden);
  // Only the hidden book can be turned and tapped; the whole column is its hover zone.
  const { zoneRef, rigRef } = useBookRig<HTMLDivElement, HTMLDivElement>(hidden, { onTap: fx.knock });

  return (
    <div className="stage__center" ref={zoneRef}>
      <Spotlight />
      <Motes />

      <div className="bookwrap">
        {hidden && (
          <div className="tome-aura" ref={fx.auraRef} aria-hidden="true">
            <div className="tome-aura__rays" />
            <div className="tome-aura__core" />
          </div>
        )}
        {book ? <Book3D book={book} /> : <SealedTome rigRef={rigRef} swayRef={fx.swayRef} sealRef={fx.sealRef} />}
        {/* The book's contact shadow — negative z-index, still inside the
            isolated stacking context `.stage__center` creates. */}
        <div className="book__contact" aria-hidden="true" />
      </div>

      <Podium />
      {hidden && <div className="tome-sparks" ref={fx.sparksRef} aria-hidden="true" />}
    </div>
  );
}
