import { formatPhone } from '@bookquest/shared';
import type {
  CertificateData,
  Participant,
  Quest,
  QuestResults,
  ResultEntry
} from '@bookquest/shared';
import { objectId } from './fixtures';

/**
 * The people in the mock: a roster big enough to page through, the results
 * derived from it, and a certificate derived from one of them.
 *
 * Everything is generated deterministically from an index, so participant 3047
 * is the same person on every reload and a screenshot taken today matches one
 * taken tomorrow.
 */

const FIRST_NAMES = [
  'Aziza',
  'Bekzod',
  'Dilnoza',
  'Eldor',
  'Feruza',
  'Gulnora',
  'Hasan',
  'Iroda',
  'Jasur',
  'Kamola',
  'Lola',
  'Madina',
  'Nodira',
  'Otabek',
  'Parviz',
  'Rustam',
  'Sardor',
  'Shahzod',
  'Umida',
  'Zilola',
  'Anvar',
  'Barno',
  'Diyor',
  'Farrux',
  'Gulbahor',
  'Ibrohim',
  'Javohir',
  'Komil',
  'Malika',
  'Nilufar'
];

const LAST_NAMES = [
  'Karimov',
  'Rashidov',
  'Toshmatov',
  'Yusupov',
  'Abdullayev',
  'Ergashev',
  'Nazarov',
  'Sultonov',
  'Ismoilov',
  'Qodirov',
  'Mirzayev',
  'Saidov',
  'Umarov',
  'Hakimov',
  'Jo‘rayev',
  'Sobirov',
  'Tursunov',
  'Xolmatov',
  'Yo‘ldoshev',
  'Zokirov'
];

/** Feminine given names take the -a ending, the way the names really work. */
const FEMININE = new Set([
  'Aziza',
  'Dilnoza',
  'Feruza',
  'Gulnora',
  'Iroda',
  'Kamola',
  'Lola',
  'Madina',
  'Nodira',
  'Umida',
  'Zilola',
  'Barno',
  'Gulbahor',
  'Malika',
  'Nilufar'
]);

/** Enough to page through at the admin default of 50 per page and mean it. */
const ROSTER_SIZE = 120;

/**
 * Participant 3047 is the number the contract's duplicate message names, so
 * the person holding it is spelled out rather than generated. Registering
 * `@sofia_k` reproduces that error verbatim.
 */
const SOFIA_INDEX = 47;
const SOFIA_CONTACT = '@sofia_k';

function fullNameFor(index: number): string {
  const first = FIRST_NAMES[index % FIRST_NAMES.length] ?? 'Aziza';
  const last = LAST_NAMES[(index * 7) % LAST_NAMES.length] ?? 'Karimov';
  return `${first} ${FEMININE.has(first) ? `${last}a` : last}`;
}

/**
 * Every third person is reachable by phone. Values go through the shared
 * formatter, so they are grouped exactly the way a real registration stores
 * them rather than approximately.
 */
function contactFor(index: number, fullName: string): Participant['contact'] {
  if (index % 3 === 2) {
    const digits = `998${90 + (index % 9)}${String(1234567 + index * 3571).slice(-7)}`;
    return { method: 'phone', value: formatPhone(digits) };
  }

  const [first = 'reader', last = 'uz'] = fullName.toLowerCase().split(' ');
  return { method: 'telegram', value: `@${first}_${last.replace(/[^a-z0-9]/g, '')}` };
}

/**
 * Registrations trail backwards from now with a widening gap: the newest are
 * minutes old, the oldest a couple of weeks. It keeps "registered today" a
 * real number at any hour, and it is the shape sign-ups actually have when
 * there is a deadline.
 */
export function buildRoster(questId: string, firstNumber: number): Participant[] {
  const step = 12 * 60 * 1000;
  const now = Date.now();

  return Array.from({ length: ROSTER_SIZE }, (_, index) => {
    const isSofia = index === SOFIA_INDEX;
    const fullName = isSofia ? 'Sofia Karimova' : fullNameFor(index);

    return {
      id: objectId(`participant:${index}`),
      number: firstNumber + index,
      fullName,
      contact: isSofia
        ? { method: 'telegram' as const, value: SOFIA_CONTACT }
        : contactFor(index, fullName),
      questId,
      registeredAt: new Date(now - (ROSTER_SIZE - index) ** 1.6 * step).toISOString()
    };
  });
}

/**
 * Scores for whoever sat the quiz, ranked the way the API ranks them: score
 * descending, then the faster run wins. The podium is the top three of the
 * same list, not a separate one.
 */
export function buildResults(takers: Participant[], quest: Quest): QuestResults {
  const total = quest.quizQuestionCount ?? 20;

  const entries = takers.map((participant, index) => ({
    number: participant.number,
    fullName: participant.fullName,
    score: total - ((index * index + index * 3) % 7),
    total,
    durationMs: (11 * 60 + ((index * 37) % 17) * 60 + ((index * 53) % 60)) * 1000
  }));

  const leaderboard: ResultEntry[] = entries
    .sort((a, b) => b.score - a.score || a.durationMs - b.durationMs)
    .map((entry, index) => ({ rank: index + 1, ...entry }));

  return {
    podium: leaderboard.slice(0, 3),
    leaderboard,
    publishedAt: quest.resultsAt
  };
}

/** The API's certificate alphabet: no 0/O/1/I/L, so a code can be read aloud. */
const CERT_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

function certificateCode(edition: number, seed: string): string {
  const hex = objectId(`cert:${seed}`);
  const suffix = Array.from({ length: 6 }, (_, index) => {
    const value = Number.parseInt(hex.slice(index * 2, index * 2 + 2), 16);
    return CERT_ALPHABET[value % CERT_ALPHABET.length];
  }).join('');

  return `BQ${edition}-${suffix}`;
}

/** A certificate is a view of participant + quest + result, never a stored copy. */
export function buildCertificate(
  participant: Participant,
  quest: Quest,
  rank: number | null
): CertificateData {
  return {
    code: certificateCode(quest.edition, String(participant.number)),
    fullName: participant.fullName,
    participantNumber: participant.number,
    questEdition: quest.edition,
    questYear: quest.year,
    bookTitle: quest.book.title,
    bookAuthor: quest.book.author,
    rank,
    issuedAt: quest.resultsAt
  };
}
