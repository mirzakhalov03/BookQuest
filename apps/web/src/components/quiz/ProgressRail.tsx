interface ProgressRailProps {
  total: number;
  /** Zero-based index of the question on screen. */
  current: number;
}

/** Neutral by design: ticks show position only, never right or wrong. */
export function ProgressRail({ total, current }: ProgressRailProps) {
  return (
    <div className="flex items-center gap-3" role="img" aria-label={`Question ${current + 1} of ${total}`}>
      <div aria-hidden className="flex flex-1 gap-1">
        {Array.from({ length: total }, (_, i) => (
          <span
            key={i}
            className={`h-1.5 min-w-0.5 flex-1 rounded-full ${
              i < current ? 'bg-paper-dim' : i === current ? 'bg-ember' : 'bg-paper/15'
            }`}
          />
        ))}
      </div>
      <span aria-hidden className="text-sm tabular-nums text-taupe">
        {current + 1} / {total}
      </span>
    </div>
  );
}
