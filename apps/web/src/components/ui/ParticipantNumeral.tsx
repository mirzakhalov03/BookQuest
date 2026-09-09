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
    <span className={className} aria-label={`Participant ${value}`}>
      {digits.map((digit, index) => (
        <span key={index} className="type-numeral" aria-hidden="true">
          {digit}
        </span>
      ))}
    </span>
  );
}
