import { ArrowRight } from 'lucide-react';

/**
 * Every primary button pairs with this, so it lives here once rather than
 * being redrawn per screen; the caller still needs `group` on the
 * surrounding `Button` for the hover/active variants below to have
 * something to key off.
 */
export function ArrowIcon() {
  return (
    <ArrowRight
      className="h-[18px] w-[18px] shrink-0 transition-transform duration-[180ms] ease-[var(--ease-soft)] group-hover:translate-x-[3px] group-active:translate-x-px"
      strokeWidth={1.8}
      aria-hidden="true"
    />
  );
}
