import { QUEST_DATE_FIELDS } from '@bookquest/shared';
import type { FieldPath, UseFormSetError } from 'react-hook-form';
import type { ApiRequestError } from '@/lib/api/client';
import type { QuestFormState } from './questForm';

const DATE_KEYS = new Set<string>(QUEST_DATE_FIELDS);
const FORM_ROOTS = new Set(['book', 'prizes', 'dates', 'quizQuestionCount', 'quizDurationMinutes']);

/** The API keys dates at the top level; the form nests them under `dates`. */
export function toFormPath(serverKey: string): string {
  return DATE_KEYS.has(serverKey) ? `dates.${serverKey}` : serverKey;
}

/**
 * Drops `error.fields` onto matching inputs (focusing the first). Returns the
 * message to show at form level: the error itself when it names no field, or
 * the first message for a key the form has no input for (`edition`, `year`).
 */
export function applyServerErrors(
  error: ApiRequestError,
  setError: UseFormSetError<QuestFormState>
): string | null {
  const entries = Object.entries(error.fields);
  if (entries.length === 0) return error.message;

  let formMessage: string | null = null;
  let focused = false;

  for (const [key, message] of entries) {
    const path = toFormPath(key);
    if (!FORM_ROOTS.has(path.split('.')[0] ?? '')) {
      formMessage ??= message;
      continue;
    }
    setError(path as FieldPath<QuestFormState>, { type: 'server', message }, { shouldFocus: !focused });
    focused = true;
  }

  return formMessage;
}
