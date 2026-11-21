import type { ReactNode, Ref } from 'react';
import { useT } from '@/i18n';

interface SealedTomeProps {
  rigRef: Ref<HTMLDivElement>;
  swayRef: Ref<HTMLDivElement>;
  sealRef: Ref<HTMLDivElement>;
}

// Board thickness: front (f), back (b), spine (s) × top, bottom, fore-edge.
const EDGES = ['ft', 'fb', 'ff', 'bt', 'bb', 'bf', 'st', 'sb'] as const;
// One ribbon band round each axis, a face for every side it crosses.
const RIBBON = ['v-front', 'v-back', 'v-top', 'v-bottom', 'h-front', 'h-back', 'h-fore', 'h-spine'] as const;

/** Leather, pressed girih, the foil that catches the light, gilt frame, hinge, stage light. */
function Board({ side, children }: { side: 'cover' | 'back'; children?: ReactNode }) {
  return (
    <div className={`tome__face tome__leather tome__${side}`}>
      <div className="tome__emboss" />
      <div className="tome__foil" />
      <div className="tome__frame" />
      <div className="tome__hinge" />
      {children}
      <div className="tome__sheen" />
    </div>
  );
}

/**
 * The book while the admin keeps it a secret: a leather hardcover tied with a
 * gold ribbon and sealed, light leaking from its pages. Styled by `tome.css`;
 * turned by `useBookRig`, lit up by `useTomeFx`.
 */
export function SealedTome({ rigRef, swayRef, sealRef }: SealedTomeProps) {
  const t = useT();
  return (
    <div className="tome-sway" ref={swayRef}>
      <div className="book-rig" ref={rigRef}>
        <div className="tome" role="img" aria-label={t.book.mysteryLabel}>
          <Board side="back">
            <span className="tome__backmark" aria-hidden="true">
              BookQuest
            </span>
          </Board>
          <div className="tome__face tome__pages tome__pages--fore" />
          <div className="tome__face tome__pages tome__pages--top" />
          <div className="tome__face tome__pages tome__pages--bottom" />
          {EDGES.map((edge) => (
            <div key={edge} className={`tome__face tome__edge tome__edge--${edge}`} />
          ))}
          <div className="tome__face tome__spine">
            <span className="tome__star tome__star--head" />
            <span className="tome__star tome__star--tail" />
          </div>
          <Board side="cover" />
          {RIBBON.map((part) => (
            <div key={part} className={`tome__face tome__ribbon tome__ribbon--${part[0]} tome__ribbon--${part}`} />
          ))}
          <div className="tome__face tome__seal-rim" />
          <div className="tome__face tome__seal" ref={sealRef}>
            <span className="tome__seal-pattern" />
            <span className="tome__mark" aria-hidden="true">
              ?
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
