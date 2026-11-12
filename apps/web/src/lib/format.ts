import { INTL_LOCALES, getLocale, getT } from '@/i18n';

/**
 * Every date and number the interface shows is formatted here and nowhere else
 * (spec §4). `Intl` does all of it, in the reader's chosen language, which is
 * why there is no date library in this app (spec §10).
 */

type Kind = 'date' | 'time' | 'compactDate' | 'shortDate' | 'count';

const OPTIONS: Record<Kind, Intl.DateTimeFormatOptions | Intl.NumberFormatOptions> = {
  date: { day: 'numeric', month: 'long', year: 'numeric' },
  // `hourCycle` is stated rather than assumed: the 24-hour clock is the design, in every language.
  time: { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' },
  compactDate: { day: '2-digit', month: '2-digit', year: '2-digit' },
  shortDate: { day: 'numeric', month: 'short' },
  count: {}
};

const cache = new Map<string, Intl.DateTimeFormat | Intl.NumberFormat>();

/** One formatter per language and kind, built on first use: constructing one is the expensive half. */
function formatter(kind: 'count'): Intl.NumberFormat;
function formatter(kind: Exclude<Kind, 'count'>): Intl.DateTimeFormat;
function formatter(kind: Kind): Intl.DateTimeFormat | Intl.NumberFormat {
  const tag = INTL_LOCALES[getLocale()];
  const key = `${tag}:${kind}`;
  let built = cache.get(key);
  if (!built) {
    built =
      kind === 'count'
        ? new Intl.NumberFormat(tag)
        : new Intl.DateTimeFormat(tag, OPTIONS[kind] as Intl.DateTimeFormatOptions);
    cache.set(key, built);
  }
  return built;
}

const toDate = (value: string | Date) => (typeof value === 'string' ? new Date(value) : value);

/**
 * "20 September 2026, 23:59" — the deadline, the quiz window, the results time.
 *
 * The API sends ISO-8601 in UTC and the client converts at the boundary, so
 * what comes out is the reader's own wall clock. That is the point: a deadline
 * they have to compare against their own evening.
 */
export function formatLongDate(value: string | Date): string {
  const date = toDate(value);
  return `${formatter('date').format(date)}, ${formatter('time').format(date)}`;
}

/** "14 December 2026" — a date that is a fact on a document (a certificate's issue date), not a moment. */
export function formatDate(value: string | Date): string {
  return formatter('date').format(toDate(value));
}

/** "27/09/26, 22:16" — a timestamp in a dense list, where the month name costs too much width. */
export function formatCompactDate(value: string | Date): string {
  const date = toDate(value);
  return `${formatter('compactDate').format(date)}, ${formatter('time').format(date)}`;
}

const MINUTE_MS = 60_000;

/** "just now", "12 min ago", "3 h ago" inside a day; the compact date past that. Exact time goes in a `title`. */
export function formatTimeAgo(value: string | Date, now = new Date()): string {
  const t = getT().format;
  const date = toDate(value);
  const minutes = Math.floor((now.getTime() - date.getTime()) / MINUTE_MS);
  if (minutes < 1) return t.justNow;
  if (minutes < 60) return t.minutesAgo(minutes);
  if (minutes < 24 * 60) return t.hoursAgo(Math.floor(minutes / 60));
  return formatCompactDate(date);
}

/** "5 Apr" — a date inside a one-line summary, where year and time are noise. */
export function formatShortDate(value: string | Date): string {
  return formatter('shortDate').format(toDate(value));
}

/** "1,204" — a quantity, so it gets thousands separators. Readers, questions, marks. */
export function formatCount(value: number): string {
  return formatter('count').format(value);
}

/**
 * "3047" — a participant number, so it gets no separators. It is a name, not a
 * quantity: "3,047" would read as three thousand people rather than as the one
 * person holding that number. This exists as its own function precisely so
 * nobody reaches for `formatCount` here.
 */
export function formatParticipantNumber(value: number): string {
  return String(value);
}

/**
 * "4m 12s" — a quiz duration: the leaderboard's tiebreaker column, and the
 * one place a stopwatch reading needs turning into words. `Intl` has no
 * stable duration formatter across the runtimes this ships to, so this is a
 * plain function like the rest of the file rather than a fourth `Intl`
 * instance. Hours only appear if the run actually took one — nothing here
 * assumes a quiz stays under sixty minutes.
 */
export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.round(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, '0');

  const t = getT().format;
  return hours > 0
    ? t.durationHms(hours, String(minutes).padStart(2, '0'), paddedSeconds)
    : t.durationMs(minutes, paddedSeconds);
}

/** "4:12.3" — a quiz time on the completion screen, where tenths are the tiebreaker made visible. */
export function formatStopwatch(durationMs: number): string {
  const tenths = Math.floor(durationMs / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor((tenths % 600) / 10);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

const ROMAN_TABLE: ReadonlyArray<readonly [number, string]> = [
  [1000, 'M'],
  [900, 'CM'],
  [500, 'D'],
  [400, 'CD'],
  [100, 'C'],
  [90, 'XC'],
  [50, 'L'],
  [40, 'XL'],
  [10, 'X'],
  [9, 'IX'],
  [5, 'V'],
  [4, 'IV'],
  [1, 'I']
];

/**
 * "IV" for 4 — the edition mark. `quest.edition` is a plain backend integer
 * (spec §11); the title page shows it as a roman numeral, so it is converted
 * here rather than left for the component to know how. A lookup table beats
 * a dependency for a competition that will not run its four-thousandth year.
 */
export function toRomanNumeral(edition: number): string {
  let remaining = edition;
  let result = '';
  for (const [amount, numeral] of ROMAN_TABLE) {
    while (remaining >= amount) {
      result += numeral;
      remaining -= amount;
    }
  }
  return result;
}

/**
 * "2026-09-20T18:59" — feeds an `<input type="datetime-local">`, the admin
 * quest editor's date fields. That input has no timezone of its own; the
 * browser shows and edits whatever digits it's given as the visitor's own
 * wall clock. So this reads the value's *local* components (not
 * `toISOString`, which would show the admin UTC digits and silently shift
 * every date by their timezone offset the moment they touched one). Reading
 * the field back is the plain reverse: `new Date(value)` on a string with no
 * timezone suffix is interpreted in the same local zone, which is exactly
 * what puts the right instant back on the wire.
 */
export function toDateTimeLocalInput(value: string): string {
  const date = new Date(value);
  const pad = (n: number) => String(n).padStart(2, '0');
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  return `${y}-${m}-${d}T${h}:${min}`;
}
