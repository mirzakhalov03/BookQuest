import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router';

type Variant = 'primary' | 'gold' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
  /** Renders as a `Link` to this route instead of a `<button>`, same styles. */
  to?: string;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember text-[#170F09] shadow-[0_0_0_1px_rgba(255,190,120,0.22)_inset,0_10px_30px_-14px_rgba(226,99,42,0.7),0_2px_0_0_var(--color-ember-deep)] hover:bg-[#EC6E33]',
  gold: 'bg-gold text-[#170F09] shadow-[0_0_0_1px_rgba(255,233,178,0.25)_inset,0_10px_30px_-14px_rgba(200,162,74,0.7),0_2px_0_0_#8A6C25] hover:bg-[#D5AF57]',
  quiet: 'text-taupe hover:text-paper-dim'
};

const BASE_CLASSES =
  'inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-box px-6 text-base font-semibold transition-transform duration-150 active:translate-y-0.5';

/**
 * The filled button is the only solid surface in the interface, which is what
 * makes it read as the action. Keep it rare.
 */
export function Button({ variant = 'primary', className = '', to, children, ...props }: ButtonProps) {
  const classes = `${BASE_CLASSES} ${VARIANTS[variant]} ${className}`;

  if (to) {
    return (
      <Link to={to} className={classes}>
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
