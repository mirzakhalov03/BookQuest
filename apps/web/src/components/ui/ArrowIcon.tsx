/**
 * The prototype's `.btn__arrow` — width 22/height 11, stroking outward on
 * hover and settling back on press. Every primary button pairs with this,
 * so it lives here once rather than being redrawn per screen; the caller
 * still needs `group` on the surrounding `Button` for the hover/active
 * variants below to have something to key off.
 */
export function ArrowIcon() {
  return (
    <svg
      className="h-[11px] w-[22px] shrink-0 stroke-current transition-transform duration-[180ms] ease-[var(--ease-soft)] group-hover:translate-x-[3px] group-active:translate-x-px"
      viewBox="0 0 24 12"
      fill="none"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M0 6h21M16 1l5 5-5 5" />
    </svg>
  );
}
