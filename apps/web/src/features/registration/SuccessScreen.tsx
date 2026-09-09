import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { haptic } from '@/lib/telegram';
import { formatParticipantNumber } from '@/lib/format';
import { useRevealHandoffStore } from './revealHandoff.store';

/**
 * `/register/success` — the emotional peak of the product, and a transient
 * route (spec §3): reached only from a mutation that just succeeded. The
 * number lives in `revealHandoff.store.ts`, read once here and cleared
 * straight after, so a reload, a pasted link, or a browser-back after
 * leaving all find nothing and bounce to `/`.
 *
 * Motion is ported from `prototype/styles/register.css` (`beam-in`,
 * `rule-draw`, `digit-set`, in `styles/register.css`) and
 * `prototype/js/app.js`'s `revealParticipantId` (the per-digit stagger
 * below) — as-is, nothing added (spec §8).
 */
export function SuccessScreen() {
  const navigate = useNavigate();
  const number = usePeekAndClearRevealNumber();

  // The one celebratory buzz in the app (plan Phase 2). Guarded on `number`
  // so the redirect-away render below never fires it for a direct visit.
  useEffect(() => {
    if (number !== null) haptic('reveal');
  }, [number]);

  if (number === null) return <Navigate to="/" replace />;

  const digits = formatParticipantNumber(number).split('');

  return (
    <div className="view--success flex flex-1 flex-col">
      <div className="success">
        <div className="success__beam" aria-hidden="true" />

        <p className="success__hail">You&rsquo;re in.</p>

        <p className="success__caption">Your participant number</p>
        <p className="success__id" aria-label={`Participant number ${number}`}>
          {digits.map((digit, index) => (
            // `.type-numeral` (base.css) fixes each digit's cell width so a
            // four-digit number doesn't reflow as digits land one at a time.
            // The stagger — 620ms base, +130ms per digit — is
            // `revealParticipantId`'s, ported exactly.
            <span
              key={index}
              className="type-numeral"
              style={{ animationDelay: `${620 + index * 130}ms` }}
              aria-hidden="true"
            >
              {digit}
            </span>
          ))}
        </p>

        <p className="success__keep">
          Keep this number. It identifies you on the leaderboard, on your quiz sheet and on your
          certificate.
        </p>

        <Button
          className="group animate-[view-in_560ms_var(--ease-out-quest)_1.45s_both]"
          onClick={() => navigate('/')}
        >
          <span>Enter BookQuest</span>
          <ArrowIcon />
        </Button>
      </div>
    </div>
  );
}

/**
 * Reads the handed-off number once, then clears the store. The read has to
 * be pure (safe to call more than once) because Strict Mode's dev-only
 * double-invoked mount calls a `useState` initialiser twice; folding the
 * clear into that same call would consume the value on the first invocation
 * and hand the second one nothing, wrongly redirecting someone who just
 * registered. The clear itself runs in an effect instead, which is a
 * mount → cleanup → mount cycle under Strict Mode — safe here since clearing
 * an already-cleared store twice is a no-op.
 */
function usePeekAndClearRevealNumber(): number | null {
  const [number] = useState(() => useRevealHandoffStore.getState().number);
  useEffect(() => {
    useRevealHandoffStore.getState().clear();
  }, []);
  return number;
}
