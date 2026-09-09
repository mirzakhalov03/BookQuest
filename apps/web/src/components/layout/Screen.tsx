import type { ReactNode } from 'react';

interface ScreenProps {
  children: ReactNode;
  /** Tailwind utilities to adjust the box — `max-w-*`, `justify-center`, etc. */
  className?: string;
}

/**
 * The box every screen sits in: one page padding, one reading measure, and the
 * clearance under the tab bar (spec §4).
 *
 * The measure and the clearance are in `styles/shell.css` under `.screen`, in
 * `@layer components`, so a screen that needs to be wider says so with a
 * `max-w-*` utility instead of this growing a variant per screen.
 */
export function Screen({ children, className = '' }: ScreenProps) {
  return <div className={`screen ${className}`}>{children}</div>;
}
