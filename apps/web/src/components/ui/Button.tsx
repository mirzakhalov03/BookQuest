import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';
import { useFieldSize } from './fieldSize';

type Variant = 'primary' | 'gold' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  /** Renders as a `Link` to this route instead of a `<button>`, same styles. */
  to?: string;
  /** Router state carried with a `to` link. */
  state?: unknown;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember text-[#170F09] shadow-[0_0_0_1px_rgba(255,190,120,0.22)_inset,0_10px_30px_-14px_rgba(226,99,42,0.7),0_2px_0_0_var(--color-ember-deep)] hover:bg-[#EC6E33]',
  gold: 'bg-gold text-[#170F09] shadow-[0_0_0_1px_rgba(255,233,178,0.25)_inset,0_10px_30px_-14px_rgba(200,162,74,0.7),0_2px_0_0_#8A6C25] hover:bg-[#D5AF57]',
  quiet: 'text-taupe hover:text-paper-dim'
};

// Size comes from `.btn` / `.btn--compact` (base.css): they sit below the utilities layer, so a `className` size override always wins.
const BASE_CLASSES =
  'btn inline-flex items-center justify-center rounded-box font-semibold transition-transform duration-150 active:translate-y-0.5';

/**
 * The filled button is the only solid surface in the interface, which is what
 * makes it read as the action. Keep it rare.
 */
export function Button({ variant = 'primary', className = '', to, state, children, ...props }: ButtonProps) {
  // Admin provides `compact`, the same signal its inputs follow.
  const size = useFieldSize() === 'compact' ? 'btn--compact' : '';
  const classes = `${BASE_CLASSES} ${size} ${VARIANTS[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} state={state} className={classes}>
        {children}
      </Link>
    );
  }

  return (
    <button {...props} className={classes}>
      {children}
    </button>
  );
}
