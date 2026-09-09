import { formatParticipantNumber } from '@/lib/format';

interface ParticipantNumeralProps {
  value: number;
  className?: string;
}

/**
 * A participant number as fixed-width digit cells — the same technique the
 * registration reveal (`SuccessScreen`) uses for its stagger, minus the
 * animation. Every digit sits in `.type-numeral`'s 0.62em box (`base.css`),
 * so a column of these — the leaderboard, the certificate — lines up: every
 * number in a run today is four digits (`PARTICIPANT_NUMBER_MIN` is 3000),
 * so equal digit counts line up equal cell counts for free.
 *
 * Shared between `results` and `profile` rather than living in either
 * feature (spec §4 rule 1) — both need the same fixed-width numeral, neither
 * owns it.
 */
export function ParticipantNumeral({ value, className = '' }: ParticipantNumeralProps) {
  const digits = formatParticipantNumber(value).split('');

  return (
    // `role="img"` names the whole number, the same fix `Book3D` already
    // uses (`stage.css`/`Book3D.tsx`): ARIA prohibits naming a bare
    // `role=generic` element, so an `aria-label` on a plain `<span>` is
    // dropped by several AT combinations and the digits underneath, each
    // individually `aria-hidden`, announce nothing.
    <span role="img" className={className} aria-label={`Participant ${value}`}>
      {digits.map((digit, index) => (
        <span key={index} className="type-numeral" aria-hidden="true">
          {digit}
        </span>
      ))}
    </span>
  );
}
