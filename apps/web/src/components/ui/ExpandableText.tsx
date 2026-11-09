import { useLayoutEffect, useRef, useState } from 'react';

interface ExpandableTextProps {
  children: string;
  /** Lines shown while collapsed. */
  lines?: number;
  className?: string;
}

/**
 * Long text clamped to a few lines, with an inline "more" that the last words
 * fade into and a "less" at the end once open. Styling is `.expandable` in
 * `styles/shell.css`. Height animates between two measured pixel values,
 * since CSS can't transition to `auto`.
 */
export function ExpandableText({ children, lines = 4, className = '' }: ExpandableTextProps) {
  const boxRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [size, setSize] = useState({ collapsed: 0, full: 0 });

  useLayoutEffect(() => {
    const box = boxRef.current;
    if (!box) return;
    const measure = () => {
      const lineHeight = parseFloat(getComputedStyle(box).lineHeight);
      setSize({ collapsed: lineHeight * lines, full: box.scrollHeight });
    };
    measure();
    // Width changes rewrap the text, so the full height has to follow.
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [children, lines]);

  const clamps = size.full > size.collapsed + 1;
  const open = expanded || !clamps;

  return (
    <div className={`expandable ${open ? 'is-open' : ''} ${className}`}>
      <div
        ref={boxRef}
        className="expandable__text"
        style={clamps ? { maxHeight: open ? size.full : size.collapsed } : undefined}
      >
        {children}
        {clamps && (
          // Always rendered so the measured full height already includes it.
          <button type="button" className="expandable__toggle expandable__less" aria-expanded={expanded} onClick={() => setExpanded(false)}>
            less
          </button>
        )}
      </div>

      {clamps && (
        <button
          type="button"
          className="expandable__toggle expandable__more"
          aria-expanded={expanded}
          onClick={() => setExpanded(true)}
        >
          more
        </button>
      )}
    </div>
  );
}
