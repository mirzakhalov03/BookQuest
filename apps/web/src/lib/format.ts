/**
 * Every date and number the interface shows is formatted here and nowhere else
 * (spec §4). `Intl` does all of it, which is why there is no date library in
 * this app (spec §10) — the whole surface is three functions.
 *
 * Formatters are built once at module load: constructing an `Intl` formatter is
 * the expensive half, and a countdown row would otherwise build one per tick.
 */

/**
 * `en-GB` for one reason only: it puts the day before the month and the clock
 * on 24 hours, which is the format the design uses. It is not a locale
 * setting — BookQuest ships one language, and the day is not the user's to
 * reorder. `hourCycle` is stated rather than assumed because `en-GB` has
 * quietly changed its default before.
 */
const DATE = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric'
});

const TIME = new Intl.DateTimeFormat('en-GB', {
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23'
});

const COUNT = new Intl.NumberFormat('en-GB');

/**
 * "20 September 2026, 23:59" — the deadline, the quiz window, the results time.
 *
 * The API sends ISO-8601 in UTC and the client converts at the boundary, so
 * what comes out is the reader's own wall clock. That is the point: a deadline
 * they have to compare against their own evening.
 */
export function formatLongDate(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  return `${DATE.format(date)}, ${TIME.format(date)}`;
}

/** "1,204" — a quantity, so it gets thousands separators. Readers, questions, marks. */
export function formatCount(value: number): string {
  return COUNT.format(value);
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
