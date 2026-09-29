import { QUEST_DATE_FIELDS, type Quest, type QuestDateField } from '@bookquest/shared';

export const DATE_LABEL: Record<QuestDateField, string> = {
  opensAt: 'Opens',
  readingDeadline: 'Reading deadline',
  quizOpensAt: 'Quiz opens',
  quizClosesAt: 'Quiz closes',
  resultsAt: 'Results published'
};

/** The stretch that *follows* each date; the last one has none. */
export const GAP_LABEL: Partial<Record<QuestDateField, string>> = {
  opensAt: 'Reading',
  readingDeadline: 'Break',
  quizOpensAt: 'Quiz',
  quizClosesAt: 'Until results'
};

export type DateInputs = Record<QuestDateField, string>;

/** `datetime-local` text → Date, or null for blank or half-typed input (Intl throws on Invalid Date). */
export function parseLocal(value: string): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatGap(from: Date | null, to: Date | null): string | null {
  if (!from || !to) return null;
  const hours = (to.getTime() - from.getTime()) / 3_600_000;
  if (hours < 0) return null;
  if (hours === 0) return 'no gap';
  if (hours < 48) return `${Math.round(hours)} h`;
  return `${Math.round(hours / 24)} days`;
}

export function questDates(quest: Quest): Record<QuestDateField, Date> {
  return Object.fromEntries(QUEST_DATE_FIELDS.map((field) => [field, new Date(quest[field])])) as Record<
    QuestDateField,
    Date
  >;
}
