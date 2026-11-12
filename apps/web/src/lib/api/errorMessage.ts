import { getLocale, getT } from '@/i18n';
import { ApiRequestError } from './client';

/**
 * What to tell a person about a failure, in their language. English shows the API's own
 * person-written message; other languages translate by `reason`, then by `code`, so an
 * untranslated server message never leaks into an Uzbek or Russian screen.
 */
export function errorMessage(error: unknown): string {
  const t = getT();
  if (!(error instanceof ApiRequestError) || error.code === 'network') return t.errors.network;
  if (error.code === 'timeout') return t.errors.timeout;
  if (getLocale() === 'en') return error.message;
  return translated(error);
}

/** The API's message for one form field, translated the same way. */
export function fieldErrorMessage(error: ApiRequestError, field: string): string | undefined {
  const raw = error.fields[field];
  if (!raw) return undefined;
  return getLocale() === 'en' ? raw : translated(error);
}

function translated(error: ApiRequestError): string {
  const t = getT();
  const reasons: Partial<Record<string, string>> = t.errors.reasons;
  const codes: Partial<Record<string, string>> = t.errors.codes;
  return (error.reason && reasons[error.reason]) || codes[error.code] || t.errors.generic;
}
