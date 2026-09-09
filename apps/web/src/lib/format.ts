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

  return hours > 0
    ? `${hours}h ${String(minutes).padStart(2, '0')}m ${paddedSeconds}s`
    : `${minutes}m ${paddedSeconds}s`;
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

const ORDINAL_WORDS = [
  'Zeroth',
  'First',
  'Second',
  'Third',
  'Fourth',
  'Fifth',
  'Sixth',
  'Seventh',
  'Eighth',
  'Ninth',
  'Tenth',
  'Eleventh',
  'Twelfth',
  'Thirteenth',
  'Fourteenth',
  'Fifteenth',
  'Sixteenth',
  'Seventeenth',
  'Eighteenth',
  'Nineteenth',
  'Twentieth'
];

/**
 * "1st", "2nd", "3rd", "41st" — a bare ordinal, no spelled-out words. This is
 * the certificate's rank line: "Forty-seventh" is an odd thing for a reading
 * competition to print, unlike the edition mark below, where the spelled-out
 * form is the whole point.
 */
export function formatOrdinal(value: number): string {
  const lastTwo = value % 100;
  const lastDigit = value % 10;
  const suffix =
    lastTwo >= 11 && lastTwo <= 13
      ? 'th'
      : lastDigit === 1
        ? 'st'
        : lastDigit === 2
          ? 'nd'
          : lastDigit === 3
            ? 'rd'
            : 'th';
  return `${value}${suffix}`;
}

/**
 * "Fourth" for 4, "21st" past twenty. The edition mark's other half — "Fourth
 * annual reading competition" — also derives from `quest.edition` rather than
 * being written once and forgotten. Spelling out every future edition
 * ("One hundred and third") is a job for a real number-to-words library,
 * which spec §10 rules out for a label this small; twenty spelled-out words
 * covers this competition for the next two decades, and a numeral ordinal
 * past that ("21st annual…") still reads as correct English indefinitely.
 */
export function formatOrdinalEdition(edition: number): string {
  const word = edition >= 1 ? ORDINAL_WORDS[edition] : undefined;
  return word ?? formatOrdinal(edition);
}
