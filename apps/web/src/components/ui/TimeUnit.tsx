import { useEffect, useRef } from 'react';

interface TimeUnitProps {
  /** Drives `data-unit`, which `stage.css` keys the seconds' ember tint and the phase skins off. */
  unit: 'days' | 'hours' | 'minutes' | 'seconds';
  value: number;
  label: string;
}

/**
 * One digit group, e.g. "07" for hours. `Countdown` in `styles/stage.css`.
 *
 * The prototype rebuilds a digit's DOM node and forces a reflow to restart
 * its tick animation, and only for the digits that actually changed. Keying
 * each span by its own character gets the same result for free: React
 * remounts a span only when its value differs from last render, and only a
 * fresh mount replays `.digit`'s animation — an unchanged digit keeps its
 * node and sits still, exactly like the prototype's days column.
 */
export function TimeUnit({ unit, value, label }: TimeUnitProps) {
  const text = String(value).padStart(2, '0');

  // The first paint should show the time, not tick into it — the tick reads
  // as *change*, and there is nothing to change from yet. `hasMounted` flips
  // after the first commit, so only real updates from here on get the class.
  const hasMounted = useRef(false);
  useEffect(() => {
    hasMounted.current = true;
  }, []);
  const tickClass = hasMounted.current ? ' is-tick' : '';

  return (
    <div className="unit" data-unit={unit}>
      <span className="unit__value">
        {[...text].map((char, index) => (
          <span key={`${index}-${char}`} className={`type-numeral digit${tickClass}`}>
            {char}
          </span>
        ))}
      </span>
      <span className="unit__name">{label}</span>
    </div>
  );
}
