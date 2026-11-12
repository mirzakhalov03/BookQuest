import type { FieldPath, UseFormSetError } from 'react-hook-form';
import type { ApiRequestError } from '@/lib/api/client';
import type { QuizFormState } from './quizForm';
import { errorMessage, fieldErrorMessage } from '@/lib/api/errorMessage';

const FORM_ROOTS = new Set(['title', 'description', 'settings', 'questions']);

/**
 * Same contract as the quest editor's `applyServerErrors`: field messages land
 * on inputs, anything else comes back as the form-level message.
 */
export function applyQuizServerErrors(
  error: ApiRequestError,
  setError: UseFormSetError<QuizFormState>
): string | null {
  const entries = Object.entries(error.fields);
  if (entries.length === 0) return errorMessage(error);

  let formMessage: string | null = null;
  let focused = false;
  for (const [key, raw] of entries) {
    const message = fieldErrorMessage(error, key) ?? raw;
    if (!FORM_ROOTS.has(key.split('.')[0] ?? '')) {
      formMessage ??= message;
      continue;
    }
    setError(key as FieldPath<QuizFormState>, { type: 'server', message }, { shouldFocus: !focused });
    focused = true;
  }
  return formMessage;
}
