import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Field, type FieldStatus } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { ApiRequestError } from '@/lib/api/client';
import { authKeys } from './useAuth';
import { loginWithEmail, registerWithEmail } from './authApi';

type Mode = 'login' | 'signup';

interface FieldState {
  value: string;
  status?: FieldStatus;
  message?: string;
}

const EMPTY_FIELD: FieldState = { value: '' };

/**
 * The open web's second sign-in option, next to `TelegramLoginWidget` — for
 * anyone who doesn't want to wait on this app's Telegram domain being set
 * up. Reuses `Field`/`Button`/`.form` from the registration form next to it
 * so the two don't read as two different products sharing a page.
 */
export function EmailAuthForm() {
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>('login');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [firstName, setFirstName] = useState<FieldState>(EMPTY_FIELD);
  const [email, setEmail] = useState<FieldState>(EMPTY_FIELD);
  const [password, setPassword] = useState<FieldState>(EMPTY_FIELD);

  const firstNameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  function switchMode() {
    setMode((current) => (current === 'login' ? 'signup' : 'login'));
    setFormError(null);
    setFirstName(EMPTY_FIELD);
    setEmail(EMPTY_FIELD);
    setPassword(EMPTY_FIELD);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setBusy(true);

    try {
      const session =
        mode === 'login'
          ? await loginWithEmail({ email: email.value, password: password.value })
          : await registerWithEmail({
              email: email.value,
              password: password.value,
              firstName: firstName.value
            });

      queryClient.setQueryData(authKeys.me(), session.user);
    } catch (error) {
      if (error instanceof ApiRequestError) {
        if (error.fields.email) {
          setEmail((prev) => ({ ...prev, status: 'bad', message: error.fields.email }));
          emailRef.current?.focus();
        } else if (error.fields.password) {
          setPassword((prev) => ({ ...prev, status: 'bad', message: error.fields.password }));
          passwordRef.current?.focus();
        } else if (error.fields.firstName) {
          setFirstName((prev) => ({ ...prev, status: 'bad', message: error.fields.firstName }));
          firstNameRef.current?.focus();
        } else {
          // The 409 (email taken) and 401 (wrong credentials) carry no
          // field — shown verbatim, same convention RegistrationForm uses
          // for its own field-less rejections.
          setFormError(error.message);
        }
      } else {
        setFormError('Something went wrong. Try again.');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {mode === 'signup' && (
        <Field
          ref={firstNameRef}
          label="Your name"
          name="firstName"
          autoComplete="given-name"
          placeholder="Jane"
          value={firstName.value}
          status={firstName.status}
          message={firstName.message}
          onChange={(event) => setFirstName({ value: event.target.value })}
        />
      )}

      <Field
        ref={emailRef}
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        placeholder="you@example.com"
        value={email.value}
        status={email.status}
        message={email.message}
        onChange={(event) => setEmail({ value: event.target.value })}
      />

      <Field
        ref={passwordRef}
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
        placeholder="••••••••"
        value={password.value}
        status={password.status}
        message={password.message}
        onChange={(event) => setPassword({ value: event.target.value })}
      />

      <Button type="submit" className="group mt-[0.3rem]" disabled={busy}>
        <span>
          {busy ? 'Working…' : mode === 'login' ? 'Log in' : 'Sign up'}
        </span>
        <ArrowIcon />
      </Button>

      {formError && (
        <p role="alert" className="m-0 text-sm text-[#E9976A]">
          {formError}
        </p>
      )}

      <button
        type="button"
        onClick={switchMode}
        className="type-label justify-self-start text-taupe transition-colors hover:text-paper-dim"
      >
        {mode === 'login' ? "Don't have an account? Sign up" : 'Already have an account? Log in'}
      </button>
    </form>
  );
}
