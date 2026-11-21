import { useLayoutEffect, useState, type RefObject } from 'react';

export interface AnchoredPosition {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
  placement: 'below' | 'above';
}

const GAP = 6;
const EDGE = 8;

/**
 * Fixed-position coordinates for a popover under (or, without room, over) its anchor.
 * Recomputes on resize; the caller closes on scroll, so the popover never drifts.
 */
export function useAnchoredPosition(
  anchor: RefObject<HTMLElement | null>,
  open: boolean,
  preferredHeight = 288
): AnchoredPosition | null {
  const [position, setPosition] = useState<AnchoredPosition | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const measure = () => {
      const el = anchor.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const below = window.innerHeight - rect.bottom - GAP - EDGE;
      const above = rect.top - GAP - EDGE;
      const placement = below >= Math.min(preferredHeight, 160) || below >= above ? 'below' : 'above';
      const room = placement === 'below' ? below : above;
      const width = Math.max(rect.width, 192);
      setPosition({
        placement,
        width,
        maxHeight: Math.min(preferredHeight, room),
        left: Math.min(Math.max(EDGE, rect.left), window.innerWidth - width - EDGE),
        top: placement === 'below' ? rect.bottom + GAP : rect.top - GAP
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [anchor, open, preferredHeight]);

  return open ? position : null;
}
