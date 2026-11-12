import { QUIZ_MCQ_OPTIONS } from '@bookquest/shared';
import { getT } from '@/i18n';

/**
 * `findQuizIssues` (shared with the API) writes fixed English; the editor shows the same
 * findings in the admin's language. Unknown messages pass through untouched.
 */
export function localizeQuizIssues(issues: Record<string, string> | null): Record<string, string> | null {
  if (!issues) return null;
  const t = getT().adminQuiz.issues;
  const known: Record<string, string> = {
    'Add at least one question.': t.addQuestion,
    'Write the question.': t.writeQuestion,
    [`Use ${QUIZ_MCQ_OPTIONS.min}–${QUIZ_MCQ_OPTIONS.max} options.`]: t.optionCount(QUIZ_MCQ_OPTIONS.min, QUIZ_MCQ_OPTIONS.max),
    'Every option needs text.': t.optionText,
    'Options must be different from each other.': t.optionsDistinct,
    'Mark the correct answer.': t.markCorrect
  };
  return Object.fromEntries(Object.entries(issues).map(([key, message]) => [key, known[message] ?? message]));
}
