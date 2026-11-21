import type { ReactNode } from 'react';
import { useBookRig } from '@/hooks/useBookRig';
import { useTomeFx } from '@/hooks/useTomeFx';
import { useT } from '@/i18n';

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
 * The book while the admin keeps it a secret — on Home's stage and on `/book`.
 * A leather hardcover tied with a gold ribbon and sealed, light leaking from
 * its pages; drag to turn it, tap to shake it. Self-contained: brings its own
 * rays, sparks and contact shadow. Sized by `--book-w`; styled by `tome.css`.
 */
export function SealedTome() {
  const t = useT();
  const fx = useTomeFx();
  const { zoneRef, rigRef } = useBookRig<HTMLDivElement, HTMLDivElement>({ onTap: fx.knock });

  return (
    <div className="tome-stage" ref={zoneRef}>
      <div className="tome-aura" ref={fx.auraRef} aria-hidden="true">
        <div className="tome-aura__rays" />
        <div className="tome-aura__core" />
      </div>
      <div className="tome-sway" ref={fx.swayRef}>
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
            <div className="tome__face tome__seal" ref={fx.sealRef}>
              <span className="tome__seal-pattern" />
              <span className="tome__mark" aria-hidden="true">
                ?
              </span>
            </div>
          </div>
        </div>
      </div>
      <div className="book__contact" aria-hidden="true" />
      <div className="tome-sparks" ref={fx.sparksRef} aria-hidden="true" />
    </div>
  );
}
