export function CharCount({ length, max }: { length: number; max: number }) {
  return (
    <span className={`text-xs tabular-nums ${length > max * 0.9 ? 'text-amber' : 'text-taupe'}`}>
      {length}/{max}
    </span>
  );
}
