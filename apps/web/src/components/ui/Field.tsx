import { forwardRef, useEffect, useId, useState } from 'react';
import type { InputHTMLAttributes, ReactNode } from 'react';

export type FieldStatus = 'good' | 'bad';

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  id?: string;
  label: string;
  /** Shown in the reserved message line. Field renders it verbatim — it does not validate anything itself. */
  message?: string;
  status?: FieldStatus;
  /**
   * Bump this (e.g. a counter incremented on every failed submit) to replay
   * the shake. It is a token, not a boolean, because a boolean can't tell
   * "shake again" from "still shaking" — see the component doc below.
   */
  shakeToken?: number;
  /** Content on the label's line — the prototype puts the contact-method Switch here. */
  head?: ReactNode;
  className?: string;
}

// Only the neutral state gets a focus border, matching the prototype's
// cascade: `.field.is-bad .field__input` and `.field.is-good .field__input`
// are declared after `.field__input:focus` in components.css, so a focused
// invalid/valid field keeps showing its status colour, not the focus one.
const INPUT_BORDER: Record<'neutral' | FieldStatus, string> = {
  neutral:
    'border-b-[color:var(--rule-strong)] focus:border-b-[color:var(--color-ember)]',
  good: 'border-b-[color:var(--rule-gold)]',
  bad: 'border-b-[color:#B2532A]'
};

// The palette has no red, deliberately — the prototype's rejected state is
// this muted ember-adjacent orange, not a warning colour borrowed from
// outside the system.
const MSG: Record<'neutral' | FieldStatus, string> = {
  neutral: 'text-taupe opacity-0 -translate-y-[3px]',
  good: 'text-gold-soft opacity-100 translate-y-0',
  bad: 'text-[#E9976A] opacity-100 translate-y-0'
};

/**
 * Label, ruled input, message slot (spec §4). Carries no product knowledge —
 * it doesn't know what a participant or a quest is, only a label, a value,
 * and a message to show under it. The registration form and the admin
 * editor both use this unmodified; validation and copy are theirs to supply.
 *
 * The shake is one-shot CSS (`nudge`, in theme.css) triggered by adding a
 * class, so replaying it needs the class to actually toggle off and back on.
 * Bumping `shakeToken` drives that: the effect below flips `isShaking` to
 * false, then to true on the next animation frame. The frame gap matters —
 * setting it to false and true in the same tick is a no-op to the browser
 * (it never paints the "off" state to restart from), which is exactly why
 * the prototype's own shake() forces a reflow between the remove and the
 * re-add. Crossing a paint via rAF does the same job without touching the
 * DOM directly.
 */
export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { id, label, message, status, shakeToken = 0, head, className = '', ...inputProps },
  ref
) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const msgId = `${fieldId}-msg`;

  const [isShaking, setIsShaking] = useState(false);
  useEffect(() => {
    if (!shakeToken) return;
    setIsShaking(false);
    // One rAF isn't enough: it fires just before the same frame that
    // `setIsShaking(false)` is about to paint, so a single nested call
    // collapses "off" and "on" into one frame and the browser never
    // actually paints the off state to restart from. Nesting a second rAF
    // defers the re-add to the frame *after* that paint — the standard
    // double-rAF pattern for forcing a real paint between two style states.
    let second = 0;
    const first = requestAnimationFrame(() => {
      second = requestAnimationFrame(() => setIsShaking(true));
    });
    return () => {
      cancelAnimationFrame(first);
      cancelAnimationFrame(second);
    };
  }, [shakeToken]);

  const borderClass = INPUT_BORDER[status ?? 'neutral'];
  const msgClass = MSG[status ?? 'neutral'];

  return (
    <div className={`grid gap-[0.4rem] ${className}`}>
      {head ? (
        <div className="flex items-baseline justify-between gap-4">
          <label htmlFor={fieldId} className="type-label">
            {label}
          </label>
          {head}
        </div>
      ) : (
        <label htmlFor={fieldId} className="type-label">
          {label}
        </label>
      )}

      <input
        {...inputProps}
        ref={ref}
        id={fieldId}
        aria-describedby={msgId}
        aria-invalid={status === 'bad' || undefined}
        className={`h-[3.25rem] w-full border-0 border-b bg-transparent px-[0.15rem] text-[1.25rem] font-medium text-paper placeholder:text-base placeholder:font-normal placeholder:text-taupe transition-[border-color,background-color] duration-[180ms] ease-linear focus:bg-[linear-gradient(180deg,transparent_60%,rgba(226,99,42,0.07))] focus:outline-none ${borderClass} ${
          isShaking ? 'animate-[nudge_320ms_var(--ease-soft)]' : ''
        }`}
      />

      <p
        id={msgId}
        role="status"
        className={`m-0 min-h-[1.15rem] text-sm leading-[1.35] [transition:opacity_180ms_linear,transform_180ms_var(--ease-out-quest)] ${msgClass}`}
      >
        {message}
      </p>
    </div>
  );
});
