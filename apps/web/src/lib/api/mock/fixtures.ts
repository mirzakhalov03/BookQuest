import type { Quest, QuestSummary, SessionUser } from '@bookquest/shared';

/**
 * The quests the mock serves, typed as the contract types.
 *
 * Typing matters more than the content here: a fixture that drifts from the
 * API shape is a type error in this file rather than a surprise inside a
 * screen three tasks from now.
 *
 * The current quest is the seeded one (`GET /quests/current` on the real API),
 * with the fields the seed leaves null filled in — cover, prizes, resources —
 * so screens have something real to lay out.
 */

/**
 * Mongo ids are 24 hex characters and they do reach the UI (admin routes key
 * off `quest.id`), so fixtures use the same shape rather than "quest-1".
 * Deterministic, so an id survives a reload and stays stable across sessions.
 */
export function objectId(seed: string): string {
  let hash = 0x811c9dc5;
  let out = '';

  for (let round = 0; out.length < 24; round++) {
    for (const char of `${seed}:${round}`) {
      hash = Math.imul(hash ^ char.charCodeAt(0), 0x01000193) >>> 0;
    }
    out += hash.toString(16).padStart(8, '0');
  }

  return out.slice(0, 24);
}

/** `phase` and `participantCount` are recomputed on every read — see store.ts. */
export const CURRENT_QUEST: Quest = {
  id: '6aa00903500a1dd1adbc47cf',
  edition: 4,
  year: 2026,
  phase: 'reading',
  book: {
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    pages: 197,
    coverUrl: 'https://covers.openlibrary.org/b/id/8408290-L.jpg',
    description:
      'A shepherd boy leaves everything he knows to follow a recurring dream. Short, plain-spoken, and about the cost of actually going.',
    resources: [
      {
        label: 'PDF (English)',
        url: 'https://archive.org/download/alchemist0000coel/alchemist0000coel.pdf',
        kind: 'pdf'
      },
      {
        label: 'EPUB (English)',
        url: 'https://archive.org/download/alchemist0000coel/alchemist0000coel.epub',
        kind: 'epub'
      },
      { label: 'Audiobook (Uzbek)', url: 'https://t.me/bookquest_uz/128', kind: 'audio' },
      { label: 'Reading guide', url: 'https://t.me/bookquest_uz/131', kind: 'link' }
    ]
  },
  prizes: {
    first: 'AirPods Pro',
    second: '1,000,000 so‘m',
    third: 'A year of books, on us'
  },
  opensAt: '2026-08-01T09:00:00.000Z',
  readingDeadline: '2026-10-10T18:59:00.000Z',
  quizOpensAt: '2026-10-11T13:00:00.000Z',
  quizClosesAt: '2026-10-11T15:00:00.000Z',
  resultsAt: '2026-10-12T07:00:00.000Z',
  quizQuestionCount: 20,
  quizDurationMinutes: 30,
  participantCount: 0
};

/**
 * An archive entry. The winner is not part of `Quest`, so it is carried
 * alongside and folded into the `QuestSummary` the archive list returns.
 */
export interface PastEdition {
  quest: Quest;
  winner: QuestSummary['winner'];
}

/** No seeded history — a fresh quest has no past editions yet either. */
export const PAST_EDITIONS: PastEdition[] = [];

/**
 * Whoever is holding the mock session. Admin by default so the admin area is
 * walkable; `window.mockApi.setRole('participant')` flips it.
 *
 * Not one of the seeded participants — `participant` starts null so the
 * "authenticated but not registered" path is the default, and registering
 * through the app is what fills it in.
 */
export const SESSION_USER: SessionUser = {
  id: objectId('user:aziza'),
  telegramUserId: '783120945',
  phoneNumber: null,
  firstName: 'Aziza',
  username: 'aziza_n',
  photoUrl: null,
  role: 'admin',
  participant: null
};

export const questSummary = ({ quest, winner }: PastEdition): QuestSummary => ({
  id: quest.id,
  edition: quest.edition,
  year: quest.year,
  bookTitle: quest.book.title,
  bookAuthor: quest.book.author,
  coverUrl: quest.book.coverUrl,
  participantCount: quest.participantCount,
  winner
});
