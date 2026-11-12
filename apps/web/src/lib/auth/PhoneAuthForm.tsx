import { useRef, useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { parseFullName } from '@bookquest/shared';
import { Field, type FieldStatus } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { ApiRequestError } from '@/lib/api/client';
import { errorMessage, fieldErrorMessage } from '@/lib/api/errorMessage';
import { setSessionUser } from './useAuth';
import { loginWithPhone, registerWithPhone } from './authApi';
import { useT } from '@/i18n';

export type AuthMode = 'login' | 'signup';

interface FieldState {
  value: string;
  status?: FieldStatus;
  message?: string;
}

const EMPTY_FIELD: FieldState = { value: '' };

interface PhoneAuthFormProps {
  mode: AuthMode;
}

/**
 * Phone number + password sign-up and sign-in. The screen around it owns which
 * mode is showing (and keys it, so switching starts from empty fields).
 */
export function PhoneAuthForm({ mode }: PhoneAuthFormProps) {
  const queryClient = useQueryClient();
  const t = useT();
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [fullName, setFullName] = useState<FieldState>(EMPTY_FIELD);
  const [phoneNumber, setPhoneNumber] = useState<FieldState>(EMPTY_FIELD);
  const [password, setPassword] = useState<FieldState>(EMPTY_FIELD);

  const fullNameRef = useRef<HTMLInputElement>(null);
  const phoneNumberRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    // Same rule the quest form and API use; caught here so a typo costs no round trip.
    const name = mode === 'signup' ? parseFullName(fullName.value) : null;
    if (name && !name.ok) {
      setFullName((prev) => ({ ...prev, status: 'bad', message: t.validation.fullName[name.code] }));
      fullNameRef.current?.focus();
      return;
    }

    setBusy(true);

    try {
      const session =
        mode === 'login'
          ? await loginWithPhone({ phoneNumber: phoneNumber.value, password: password.value })
          : await registerWithPhone({
              phoneNumber: phoneNumber.value,
              password: password.value,
              // The account model calls it `firstName`; it holds the whole name.
              firstName: name?.ok ? name.value : fullName.value
            });

      setSessionUser(queryClient, session.user);
    } catch (error) {
      if (error instanceof ApiRequestError && error.fields.phoneNumber) {
        setPhoneNumber((prev) => ({ ...prev, status: 'bad', message: fieldErrorMessage(error, 'phoneNumber') }));
        phoneNumberRef.current?.focus();
      } else if (error instanceof ApiRequestError && error.fields.password) {
        setPassword((prev) => ({ ...prev, status: 'bad', message: fieldErrorMessage(error, 'password') }));
        passwordRef.current?.focus();
      } else if (error instanceof ApiRequestError && error.fields.firstName) {
        setFullName((prev) => ({ ...prev, status: 'bad', message: fieldErrorMessage(error, 'firstName') }));
        fullNameRef.current?.focus();
      } else {
        // The 409 (phone number taken) and 401 (wrong credentials) carry no field.
        setFormError(errorMessage(error));
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      {mode === 'signup' && (
        <Field
          ref={fullNameRef}
          label={t.auth.fullName}
          name="fullName"
          autoComplete="name"
          placeholder={t.auth.fullNamePlaceholder}
          value={fullName.value}
          status={fullName.status}
          message={fullName.message}
          onChange={(event) => setFullName({ value: event.target.value })}
        />
      )}

      <Field
        ref={phoneNumberRef}
        label={t.auth.phone}
        name="phoneNumber"
        type="tel"
        autoComplete="tel"
        placeholder="+998901234567"
        value={phoneNumber.value}
        status={phoneNumber.status}
        message={phoneNumber.message}
        onChange={(event) => setPhoneNumber({ value: event.target.value })}
      />

      <Field
        ref={passwordRef}
        label={t.auth.password}
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
          {busy ? t.auth.working : mode === 'login' ? t.common.logIn : t.auth.register}
        </span>
        <ArrowIcon />
      </Button>

      {formError && (
        <p role="alert" className="m-0 text-sm text-error">
          {formError}
        </p>
      )}
    </form>
  );
}
