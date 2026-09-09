type Size = 'sm' | 'md';

interface SpinnerProps {
  /** `sm` sits inline with text (a pending button); `md` stands alone (LoadingState). */
  size?: Size;
  className?: string;
}

const SIZES: Record<Size, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-6 w-6 border-[3px]'
};

/**
 * A quiet ring, not a screen of its own. The amber segment is what reads as
 * motion — under `prefers-reduced-motion` (neutralised globally in base.css)
 * it just sits still as a ring with one lighter arc, which is still legible
 * as "working on it" without a second no-motion code path.
 */
export function Spinner({ size = 'sm', className = '' }: SpinnerProps) {
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 animate-spin rounded-full border-taupe/30 border-t-amber ${SIZES[size]} ${className}`}
    />
  );
}
