const WORDS = [
  'Zeroth', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth',
  'Eleventh', 'Twelfth', 'Thirteenth', 'Fourteenth', 'Fifteenth', 'Sixteenth', 'Seventeenth', 'Eighteenth',
  'Nineteenth', 'Twentieth'
];

/** "1st", "22nd", "113th". */
export function ordinalEn(n: number): string {
  const lastTwo = n % 100;
  const last = n % 10;
  const suffix = lastTwo >= 11 && lastTwo <= 13 ? 'th' : last === 1 ? 'st' : last === 2 ? 'nd' : last === 3 ? 'rd' : 'th';
  return `${n}${suffix}`;
}

/** "Fourth" up to twenty, then "21st" — the edition mark reads as words while it can. */
export const ordinalWordEn = (n: number): string => (n >= 1 && WORDS[n]) || ordinalEn(n);
