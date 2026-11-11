import { Check, X } from 'lucide-react';

export type OptionState = 'idle' | 'selected' | 'locked' | 'correct' | 'wrong';

interface OptionButtonProps {
  /** A-F for multiple choice; `null` for True/False, which has no letter badge. */
  letter: string | null;
  text: string;
  state: OptionState;
  disabled?: boolean;
  onClick: () => void;
}

const STATE_STYLES: Record<OptionState, string> = {
  idle: 'border-paper/15 bg-ash text-paper hover:border-paper/35 active:bg-ash-hi',
  selected: 'border-ember bg-ash-hi text-paper',
  locked: 'border-ember bg-ember text-[#170F09]',
  correct: 'border-gold bg-gold/15 text-paper',
  wrong: 'border-error-line bg-ash text-error'
};

const BADGE_STYLES: Record<OptionState, string> = {
  idle: 'border-paper/25 text-taupe',
  selected: 'border-ember bg-ember text-[#170F09]',
  locked: 'border-[#170F09]/60 text-[#170F09]',
  correct: 'border-gold bg-gold text-[#170F09]',
  wrong: 'border-error-line text-error'
};

export function OptionButton({ letter, text, state, disabled = false, onClick }: OptionButtonProps) {
  const marked = state === 'selected' || state === 'locked' || state === 'correct';

  return (
    <button
      type="button"
      aria-pressed={state === 'selected' || state === 'locked'}
      disabled={disabled}
      onClick={onClick}
      className={`flex min-h-14 w-full items-center gap-3 rounded-box border px-4 py-3 text-left text-base font-medium transition-colors duration-150 motion-reduce:transition-none disabled:cursor-default ${STATE_STYLES[state]}`}
    >
      {letter && (
        <span
          aria-hidden
          className={`grid h-8 w-8 shrink-0 place-items-center rounded-chip border text-sm font-semibold ${BADGE_STYLES[state]}`}
        >
          {letter}
        </span>
      )}
      <span className="min-w-0 flex-1 break-words">{text}</span>
      {marked && <Check aria-hidden className="h-5 w-5 shrink-0" />}
      {state === 'wrong' && <X aria-hidden className="h-5 w-5 shrink-0" />}
    </button>
  );
}
