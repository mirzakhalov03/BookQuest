import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TelegramCodeChallenge } from '@bookquest/shared';
import { Field, type FieldStatus } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { ApiRequestError } from '@/lib/api/client';
import { useCountdown } from '@/hooks/useCountdown';
import { requestTelegramCode, verifyTelegramCode } from './authApi';
import { setSessionUser } from './useAuth';

interface FieldState {
  value: string;
  status?: FieldStatus;
  message?: string;
}

const EMPTY_FIELD: FieldState = { value: '' };
// Mirrors the server's cooldown so the button unlocks when a resend would succeed.
const RESEND_COOLDOWN_MS = 60_000;

const messageFor = (error: unknown): string =>
  error instanceof ApiRequestError ? error.message : FALLBACK_MESSAGE;

/**
 * Passwordless web login for Telegram-made accounts: identify, then type the
 * code the bot sent. Two steps in one component because they share the challenge.
 */
export function TelegramCodeLogin() {
  const queryClient = useQueryClient();
  const [challenge, setChallenge] = useState<TelegramCodeChallenge | null>(null);
  const [identifier, setIdentifier] = useState<FieldState>(EMPTY_FIELD);
  const [code, setCode] = useState<FieldState>(EMPTY_FIELD);
  const [codeShake, setCodeShake] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resendAt, setResendAt] = useState<Date | null>(null);

  const left = useCountdown(resendAt);
  const cooldown = left.minutes * 60 + left.seconds;

  async function sendCode(event?: FormEvent) {
    event?.preventDefault();
    setFormError(null);
    setBusy(true);
    try {
      setChallenge(await requestTelegramCode(identifier.value));
      setCode(EMPTY_FIELD);
      setResendAt(new Date(Date.now() + RESEND_COOLDOWN_MS));
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.identifier) {
        setIdentifier((prev) => ({ ...prev, status: 'bad', message: error.fields.identifier }));
      } else {
        setFormError(messageFor(error));
      }
    } finally {
      setBusy(false);
    }
  }

  async function logIn(event: FormEvent) {
    event.preventDefault();
    if (!challenge) return;
    setFormError(null);
    setBusy(true);
    try {
      const session = await verifyTelegramCode(challenge.challengeId, code.value);
      setSessionUser(queryClient, session.user);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.code) {
        setCode((prev) => ({ ...prev, status: 'bad', message: error.fields.code }));
        setCodeShake((count) => count + 1);
      } else {
        // 410: expired or out of tries — clear the field; "Send a new code" is right below.
        if (error instanceof ApiRequestError && error.status === 410) setCode(EMPTY_FIELD);
        setFormError(messageFor(error));
      }
    } finally {
      setBusy(false);
    }
  }

  function startOver() {
    setChallenge(null);
    setCode(EMPTY_FIELD);
    setFormError(null);
  }

  if (!challenge) {
    return (
      <form className="form" onSubmit={sendCode} noValidate>
        {/* Grouped so the form's gap doesn't split the hint from its field; Field's own
            message slot is invisible in the neutral state, so the hint can't live there. */}
        <div className="grid">
          <Field
            label="Reg number, phone or @username"
            name="identifier"
            autoComplete="username"
            placeholder="#0142"
            value={identifier.value}
            status={identifier.status}
            message={identifier.message}
            onChange={(event) => setIdentifier({ value: event.target.value })}
          />
          <p className="form__note">We'll send a code to your Telegram.</p>
        </div>
        <Button type="submit" className="group mt-[0.3rem]" disabled={busy}>
          <span>{busy ? 'Sending…' : 'Send code'}</span>
          <ArrowIcon />
        </Button>
        {formError && <FormError message={formError} />}
      </form>
    );
  }

  return (
    <form className="form" onSubmit={logIn} noValidate>
      <Field
        label={`Code sent to ${challenge.sentTo}`}
        name="code"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        placeholder="000000"
        autoFocus
        value={code.value}
        status={code.status}
        message={code.message}
        shakeToken={codeShake}
        onChange={(event) => setCode({ value: event.target.value.replace(/\D/g, '') })}
      />
      <Button type="submit" className="group mt-[0.3rem]" disabled={busy || code.value.length !== 6}>
        <span>{busy ? 'Checking…' : 'Log in'}</span>
        <ArrowIcon />
      </Button>
      {formError && <FormError message={formError} />}

      <div className="flex flex-wrap justify-between gap-3">
        <QuietAction onClick={() => void sendCode()} disabled={busy || cooldown > 0}>
          {cooldown > 0 ? `Send a new code in ${cooldown}s` : 'Send a new code'}
        </QuietAction>
        <QuietAction onClick={startOver}>Use something else</QuietAction>
      </div>
    </form>
  );
}

function FormError({ message }: { message: string }) {
  return (
    <p role="alert" className="m-0 text-sm text-error">
      {message}
    </p>
  );
}

function QuietAction({
  onClick,
  disabled,
  children
}: {
  onClick: () => void;
  disabled?: boolean;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="type-label text-taupe transition-colors hover:text-paper-dim disabled:opacity-50 disabled:hover:text-taupe"
    >
      {children}
    </button>
  );
}
