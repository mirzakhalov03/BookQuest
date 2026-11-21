import type { CSSProperties } from 'react';

/** Six gold motes flung out from the mascot as it lands (`.mascot__sparkles`, profile.css). */
export function Sparkles() {
  return (
    <span className="mascot__sparkles" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <span key={index} style={{ '--i': index } as CSSProperties} />
      ))}
    </span>
  );
}
