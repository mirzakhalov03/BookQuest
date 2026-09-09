import { useState } from 'react';

interface Mote {
  left: string;
  top: string;
  duration: string;
  delay: string;
  opacity: number;
}

const MOTE_COUNT = 14;

function seedMotes(): Mote[] {
  // The prototype skips generating any motes at all under reduced motion,
  // rather than creating 14 elements whose animation base.css then just
  // freezes into a single flash of opacity. No dust reads as more honest
  // than dust doing an impression of stillness.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return [];

  return Array.from({ length: MOTE_COUNT }, () => ({
    left: `${8 + Math.random() * 84}%`,
    top: `${30 + Math.random() * 65}%`,
    duration: `${9 + Math.random() * 9}s`,
    delay: `${-Math.random() * 12}s`,
    opacity: 0.2 + Math.random() * 0.5
  }));
}

/**
 * Drifting dust in the beam. Generated once, via `useState`'s lazy
 * initialiser, not on every render — the countdown ticks once a second
 * elsewhere on this screen, and reshuffling the whole beam every second
 * would read as static, not atmosphere. Spread matches the prototype's
 * `seedMotes()` in `prototype/js/app.js` exactly: 14 particles, an 8–92%
 * band across the width, 9–18s drifts starting mid-cycle.
 */
export function Motes() {
  const [motes] = useState(seedMotes);

  return (
    <div className="motes" aria-hidden="true">
      {motes.map((mote, index) => (
        <span
          key={index}
          className="mote"
          style={{
            left: mote.left,
            top: mote.top,
            animationDuration: mote.duration,
            animationDelay: mote.delay,
            opacity: mote.opacity
          }}
        />
      ))}
    </div>
  );
}
