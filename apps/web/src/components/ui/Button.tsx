import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'gold' | 'quiet';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  children: ReactNode;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-ember text-[#170F09] shadow-[0_0_0_1px_rgba(255,190,120,0.22)_inset,0_10px_30px_-14px_rgba(226,99,42,0.7),0_2px_0_0_var(--color-ember-deep)] hover:bg-[#EC6E33]',
  gold: 'bg-gold text-[#170F09] shadow-[0_0_0_1px_rgba(255,233,178,0.25)_inset,0_10px_30px_-14px_rgba(200,162,74,0.7),0_2px_0_0_#8A6C25] hover:bg-[#D5AF57]',
  quiet: 'text-taupe hover:text-paper-dim'
};

/**
 * The filled button is the only solid surface in the interface, which is what
 * makes it read as the action. Keep it rare.
 */
export function Button({ variant = 'primary', className = '', children, ...props }: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex min-h-[3.25rem] items-center justify-center gap-3 rounded-[3px] px-6 text-base font-semibold transition-transform duration-150 active:translate-y-0.5 ${VARIANTS[variant]} ${className}`}
    >
      {children}
    </button>
  );
}
