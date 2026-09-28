import { useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { groupUzbek, parseFullName, parsePhoneNumber, parseTelegramUsername } from '@bookquest/shared';
import type { ContactMethod } from '@bookquest/shared';
import { Field, type FieldStatus } from '@/components/ui/Field';
import { Switch } from '@/components/ui/Switch';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { ApiRequestError } from '@/lib/api/client';
import { haptic } from '@/lib/telegram';
import { useContactMethodStore } from '@/stores/contactMethod.store';
import { useRegister } from '../api/useRegister';
import { useRevealHandoffStore } from '../revealHandoff.store';

interface FieldState {
  value: string;
  status?: FieldStatus;
  message?: string;
}

const EMPTY_FIELD: FieldState = { value: '' };

const CONTACT_OPTIONS = [
  { value: 'telegram', label: 'Telegram' },
  { value: 'phone', label: 'Phone' }
] as const;

const CONTACT_PLACEHOLDER: Record<ContactMethod, string> = {
  telegram: '@your_username',
  phone: '+998 90 123 45 67'
};

/**
 * Name, contact and the switch between them (spec §4). Validation runs
 * twice on purpose (spec §6): `parseFullName` / `parseTelegramUsername` /
 * `parsePhoneNumber` from `@bookquest/shared` give instant feedback here,
 * and the API runs the exact same functions when the form actually submits
 * — so a client-side "pass" can still come back rejected (a contact taken
 * in the meantime, a name banned by a rule added since page load), and that
 * has to render as well as a client-side rejection does.
 */
export function RegistrationForm() {
  const navigate = useNavigate();
  const method = useContactMethodStore((state) => state.method);
  const setMethod = useContactMethodStore((state) => state.setMethod);
  const setRevealNumber = useRevealHandoffStore((state) => state.setNumber);
  const register = useRegister();

  const [name, setName] = useState<FieldState>(EMPTY_FIELD);
  const [contact, setContact] = useState<FieldState>(EMPTY_FIELD);
  const [nameShake, setNameShake] = useState(0);
  const [contactShake, setContactShake] = useState(0);
  // Field-less rejections — a closed quest, a contact already claimed by
  // someone else — belong to neither input, so they get their own line
  // rather than being pinned to a field they aren't about (spec §6).
  const [formError, setFormError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);
  const contactInputRef = useRef<HTMLInputElement>(null);

  function checkName(): boolean {
    const result = parseFullName(name.value);
    if (result.ok) {
      // Shows the normalised name back on success (spec §4 rule 3) — "sofia
      // karimova" becomes "Sofia Karimova" the moment it passes.
      setName({ value: result.value, status: 'good' });
      return true;
    }
    setName((prev) => ({ ...prev, status: 'bad', message: result.message }));
    return false;
  }

  function checkContact(): boolean {
    const result =
      method === 'telegram' ? parseTelegramUsername(contact.value) : parsePhoneNumber(contact.value);
    if (result.ok) {
      setContact({ value: result.value, status: 'good' });
      return true;
    }
    setContact((prev) => ({ ...prev, status: 'bad', message: result.message }));
    return false;
  }

  function handleNameChange(value: string) {
    setName((prev) => (prev.status === 'bad' ? { value } : { ...prev, value }));
  }

  function handleContactChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    let value = input.value;

    // Uzbek numbers group as you type; every other country's digits are left
    // exactly as entered (spec §4) — inventing groups for an unknown format
    // is worse than showing none. Only reformats at the caret's rightmost
    // position, matching prototype/js/validate.js's `livePhone`, so typing
    // into the middle of an already-grouped number is never rewritten under
    // the cursor.
    if (method === 'phone' && input.selectionStart === value.length) {
      const grouped = groupUzbek(value.replace(/\D/g, ''));
      if (grouped) value = grouped;
    }

    setContact((prev) => (prev.status === 'bad' ? { value } : { ...prev, value }));
  }

  function handleMethodChange(next: ContactMethod) {
    setMethod(next);
    haptic('select');
    // A fresh field for a fresh format, matching the prototype: reinterpreting
    // "@sofia" as a phone number (or the reverse) helps nobody.
    setContact(EMPTY_FIELD);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);

    const nameOk = checkName();
    const contactOk = checkContact();

    // Matches the prototype: both fields validate on every submit attempt,
    // but focus goes to whichever is wrong first rather than both at once.
    if (!nameOk) {
      haptic('error');
      setNameShake((count) => count + 1);
      nameInputRef.current?.focus();
      return;
    }
    if (!contactOk) {
      haptic('error');
      setContactShake((count) => count + 1);
      contactInputRef.current?.focus();
      return;
    }

    haptic('action');

    try {
      const participant = await register.mutateAsync({
        fullName: name.value,
        contactMethod: method,
        contactValue: contact.value
      });
      setRevealNumber(participant.number);
      navigate('/me/welcome');
    } catch (error) {
      haptic('error');

      if (!(error instanceof ApiRequestError)) {
        setFormError(FALLBACK_MESSAGE);
        return;
      }

      // `error.fields` keys the same as the request body (spec §6) — no
      // translation layer, straight onto the matching input.
      if (error.fields.fullName) {
        setName((prev) => ({ ...prev, status: 'bad', message: error.fields.fullName }));
      }
      if (error.fields.contactValue) {
        setContact((prev) => ({ ...prev, status: 'bad', message: error.fields.contactValue }));
      }
      if (!error.fields.fullName && !error.fields.contactValue) {
        // The 409s — a taken contact, a closed quest — carry no field.
        // Shown verbatim (spec §6); the exact wording is the server's call.
        setFormError(error.message);
      }
    }
  }

  return (
    <form className="form" onSubmit={handleSubmit} noValidate>
      <Field
        ref={nameInputRef}
        label="Full name"
        name="fullname"
        autoComplete="name"
        spellCheck={false}
        placeholder="Sofia Karimova"
        value={name.value}
        status={name.status}
        message={name.message}
        shakeToken={nameShake}
        onChange={(event) => handleNameChange(event.target.value)}
        onBlur={() => {
          if (name.value.trim()) checkName();
        }}
      />

      <Field
        ref={contactInputRef}
        label="How we reach you"
        name="contact"
        head={
          <Switch
            aria-label="Contact method"
            options={CONTACT_OPTIONS}
            value={method}
            onChange={handleMethodChange}
          />
        }
        inputMode={method === 'phone' ? 'tel' : 'text'}
        autoComplete="off"
        spellCheck={false}
        placeholder={CONTACT_PLACEHOLDER[method]}
        value={contact.value}
        status={contact.status}
        message={contact.message}
        shakeToken={contactShake}
        onChange={handleContactChange}
        onBlur={() => {
          if (contact.value.trim()) checkContact();
        }}
      />

      <Button type="submit" className="group mt-[0.3rem]" disabled={register.isPending}>
        <span>{register.isPending ? 'Claiming your place…' : 'Claim your place'}</span>
        <ArrowIcon />
      </Button>

      {formError && (
        <p role="alert" className="m-0 text-sm text-[#E9976A]">
          {formError}
        </p>
      )}

      <p className="form__note">Your number goes on the leaderboard, your quiz sheet and your certificate.</p>
    </form>
  );
}
