/**
 * Full-name rules.
 *
 * These live in the shared package on purpose: the browser uses them to give
 * instant, friendly feedback, and the API uses exactly the same rules so a
 * crafted request cannot get past them. One source of truth, two callers.
 */

const VOWELS = /[aeiouyàáâãäåèéêëìíîïòóôõöùúûüýÿœæаеёиоуыэюя]/i;
const LETTER = /\p{L}/u;
const KEYBOARD_ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm', '1234567890'];

/** Four or more keys typed straight along one keyboard row. */
function isKeyboardRun(word: string): boolean {
  const w = word.toLowerCase();
  return KEYBOARD_ROWS.some((row) => {
    const back = [...row].reverse().join('');
    for (let i = 0; i + 4 <= w.length; i++) {
      const chunk = w.slice(i, i + 4);
      if (row.includes(chunk) || back.includes(chunk)) return true;
    }
    return false;
  });
}

export function looksLikeMashing(word: string): boolean {
  const w = word.toLowerCase();

  if (!VOWELS.test(w)) return true;
  if (/(\p{L})\1{2,}/u.test(w)) return true;
  if (isKeyboardRun(w)) return true;

  let consonantRun = 0;
  let vowelRun = 0;
  let vowelCount = 0;

  for (const ch of w) {
    if (!LETTER.test(ch)) continue;
    if (VOWELS.test(ch)) {
      vowelCount++;
      vowelRun++;
      consonantRun = 0;
    } else {
      consonantRun++;
      vowelRun = 0;
    }
    if (consonantRun >= 5 || vowelRun >= 4) return true;
  }

  // Counted across the full vowel set so Cyrillic names are not rejected.
  return w.length >= 5 && vowelCount / w.length < 0.18;
}

/** "sofia   karimova" -> "Sofia Karimova", "o'brien" -> "O'Brien" */
export function titleCaseWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/^Mc(\p{L})/u, (_, ch: string) => 'Mc' + ch.toUpperCase());
}

export type FullNameResult =
  | { ok: true; value: string }
  | { ok: false; message: string };

/**
 * Validates and normalises a full name in one pass, so callers never have to
 * remember to normalise separately. Messages describe what a good answer looks
 * like rather than announcing that the input was wrong.
 */
export function parseFullName(raw: string): FullNameResult {
  const value = (raw ?? '').replace(/\s+/g, ' ').trim();

  if (!value) return fail('Your name goes on the certificate — add it here.');
  if (/\d/.test(value)) return fail('Names don’t have numbers in them.');
  if (/[^\p{L}\s'’-]/u.test(value)) return fail('Letters, hyphens and apostrophes only.');

  const words = value.split(' ').filter(Boolean);

  if (words.length < 2) return fail('Please enter your first and last name.');
  if (words.length > 2) return fail('First and last name is enough — two words.');
  if (words.some((w) => w.replace(/[^\p{L}]/gu, '').length < 2)) {
    return fail('Both names need at least two letters.');
  }
  if (words.some(looksLikeMashing)) {
    return fail('That doesn’t look like a name yet. Try your real one.');
  }

  return { ok: true, value: words.map(titleCaseWord).join(' ') };
}

function fail(message: string): FullNameResult {
  return { ok: false, message };
}
