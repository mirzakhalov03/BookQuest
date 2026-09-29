import { QUEST_DATE_FIELDS, type UpdateQuestPayload } from '@bookquest/shared';
import type { FieldErrors } from 'react-hook-form';
import type { QuestFormState } from './questForm';

export type EditorSectionId = 'book' | 'resources' | 'prizes' | 'dates' | 'quiz';

export interface ChangeSummary {
  count: number;
  sections: ReadonlySet<EditorSectionId>;
}

export const NO_CHANGES: ChangeSummary = { count: 0, sections: new Set() };

/**
 * Counted from the patch, not from raw input, so "3 changes" is exactly what
 * Save will send — a trailing space doesn't count. The resource list is one change.
 */
export function summarizeChanges(patch: UpdateQuestPayload | null): ChangeSummary {
  if (!patch) return NO_CHANGES;

  const sections = new Set<EditorSectionId>();
  let count = 0;
  const tally = (section: EditorSectionId, n: number) => {
    if (n === 0) return;
    count += n;
    sections.add(section);
  };

  const { resources, ...book } = patch.book ?? {};
  tally('book', Object.keys(book).length);
  tally('resources', resources ? 1 : 0);
  tally('prizes', Object.keys(patch.prizes ?? {}).length);
  tally('dates', QUEST_DATE_FIELDS.filter((field) => patch[field] !== undefined).length);
  tally(
    'quiz',
    (['quizQuestionCount', 'quizDurationMinutes'] as const).filter((key) => patch[key] !== undefined).length
  );

  return { count, sections };
}

export function sectionsWithErrors(errors: FieldErrors<QuestFormState>): ReadonlySet<EditorSectionId> {
  const sections = new Set<EditorSectionId>();
  const { resources, ...book } = errors.book ?? {};

  if (Object.keys(book).length > 0) sections.add('book');
  if (resources) sections.add('resources');
  if (errors.prizes) sections.add('prizes');
  if (errors.dates) sections.add('dates');
  if (errors.quizQuestionCount || errors.quizDurationMinutes) sections.add('quiz');
  return sections;
}

/** Leaf errors only. `ref` is skipped — it's a DOM node, and walking one never ends well. */
export function countErrors(errors: object): number {
  return Object.entries(errors).reduce<number>((total, [key, value]) => {
    if (key === 'ref' || !value || typeof value !== 'object') return total;
    if ('message' in value && typeof value.message === 'string') return total + 1;
    return total + countErrors(value);
  }, 0);
}
