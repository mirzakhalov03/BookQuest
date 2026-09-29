import { QUEST_DATE_FIELDS, type Quest, type QuestDateField } from '@bookquest/shared';
import { toDateTimeLocalInput } from '@/lib/format';

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

const minutesOfDay = (date: Date) => date.getHours() * 60 + date.getMinutes();
const localDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();

/**
 * Moves every later date by the same calendar days and wall-clock minutes as
 * `field` moved, so the schedule keeps its rhythm. Days and minutes rather than
 * raw milliseconds, so a daylight-saving change never turns 18:00 into 19:00.
 */
export function shiftLaterDates(dates: DateInputs, field: QuestDateField, nextValue: string): DateInputs {
  const next: DateInputs = { ...dates, [field]: nextValue };
  const before = parseLocal(dates[field]);
  const after = parseLocal(nextValue);
  if (!before || !after) return next;

  const dayShift = Math.round((localDay(after) - localDay(before)) / 86_400_000);
  const minuteShift = minutesOfDay(after) - minutesOfDay(before);

  for (const later of QUEST_DATE_FIELDS.slice(QUEST_DATE_FIELDS.indexOf(field) + 1)) {
    const current = parseLocal(dates[later]);
    if (!current) continue;
    const moved = new Date(current);
    moved.setDate(moved.getDate() + dayShift);
    moved.setMinutes(moved.getMinutes() + minuteShift);
    next[later] = toDateTimeLocalInput(moved.toISOString());
  }
  return next;
}
