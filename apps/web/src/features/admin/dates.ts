import { QUEST_DATE_FIELDS, type Quest, type QuestDateField } from '@bookquest/shared';
import { toDateTimeLocalInput } from '@/lib/format';
import { getT } from '@/i18n';

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
  const t = getT().admin;
  if (hours === 0) return t.gapNone;
  if (hours < 48) return t.gapHours(Math.round(hours));
  return t.gapDays(Math.round(hours / 24));
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

/** Same calendar position a year on — the natural first guess for next year's schedule. */
export function plusOneYear(iso: string): string {
  const date = new Date(iso);
  date.setFullYear(date.getFullYear() + 1);
  return toDateTimeLocalInput(date.toISOString());
}

/** A sensible first schedule when there's no previous edition to copy: 60 days' reading, a 2-day quiz. */
export function defaultDates(now: Date): DateInputs {
  const at = (days: number, hour: number) => {
    const date = new Date(now);
    date.setDate(date.getDate() + 7 + days);
    date.setHours(hour, 0, 0, 0);
    return toDateTimeLocalInput(date.toISOString());
  };
  return {
    opensAt: at(0, 9),
    readingDeadline: at(60, 18),
    quizOpensAt: at(60, 18),
    quizClosesAt: at(62, 18),
    resultsAt: at(63, 12)
  };
}
