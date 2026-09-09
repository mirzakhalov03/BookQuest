type RuleVariant = 'plain' | 'gold';

interface RuleProps {
  /** `gold` for the rare moments that earn it — winners, a plate number. */
  variant?: RuleVariant;
  className?: string;
}

const VARIANTS: Record<RuleVariant, string> = {
  plain: 'bg-[color:var(--rule)]',
  gold: 'bg-[color:var(--rule-gold)]'
};

/**
 * A hairline divider (spec §4) — one property, two tokens. `<hr>` rather
 * than a `<div>` because it is semantically a divider, not decoration.
 */
export function Rule({ variant = 'plain', className = '' }: RuleProps) {
  return <hr className={`m-0 h-px border-0 ${VARIANTS[variant]} ${className}`} />;
}
