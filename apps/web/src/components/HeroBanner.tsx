import type { ReactNode } from 'react';

interface HeroBannerProps {
  /** A plain string gets the amber label style; pass a node (e.g. `EditionMark`) to style it yourself. */
  label: ReactNode;
  title: string;
}

/** Edge-to-edge gradient header for a screen's first moment — sign-in and joining. Styles in `register.css`. */
export function HeroBanner({ label, title }: HeroBannerProps) {
  return (
    <header className="screen-bleed hero-banner">
      <div className="relative">
        {typeof label === 'string' ? <p className="type-label m-0 text-amber">{label}</p> : label}
      </div>
      {/* Keyed so the rise replays when the title swaps. */}
      <h1 key={title} className="type-display hero-banner__title">
        {title}
      </h1>
    </header>
  );
}
