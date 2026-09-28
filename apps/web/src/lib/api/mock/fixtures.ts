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

function pastQuest(
  edition: number,
  year: number,
  book: Quest['book'],
  prizes: Quest['prizes'],
  participantCount: number
): Quest {
  return {
    id: objectId(`quest:${edition}`),
    edition,
    year,
    phase: 'finished',
    book,
    prizes,
    opensAt: `${year}-08-01T09:00:00.000Z`,
    readingDeadline: `${year}-09-20T18:59:00.000Z`,
    quizOpensAt: `${year}-09-21T13:00:00.000Z`,
    quizClosesAt: `${year}-09-21T15:00:00.000Z`,
    resultsAt: `${year}-09-22T07:00:00.000Z`,
    quizQuestionCount: 20,
    quizDurationMinutes: 30,
    participantCount
  };
}

/** Newest first, which is the order the archive endpoint promises. */
export const PAST_EDITIONS: PastEdition[] = [
  {
    quest: pastQuest(
      3,
      2025,
      {
        title: 'The Old Man and the Sea',
        author: 'Ernest Hemingway',
        pages: 127,
        coverUrl: 'https://covers.openlibrary.org/b/id/8231856-L.jpg',
        description:
          'An old fisherman, a marlin bigger than his boat, and two days alone at sea. Hemingway at his shortest and least forgiving.',
        resources: [
          { label: 'PDF (English)', url: 'https://t.me/bookquest_uz/94', kind: 'pdf' },
          { label: 'Audiobook (Uzbek)', url: 'https://t.me/bookquest_uz/95', kind: 'audio' }
        ]
      },
      { first: 'iPad (10th gen)', second: '750,000 so‘m', third: 'A stack of books' },
      412
    ),
    winner: { number: 3218, fullName: 'Dilnoza Rashidova' }
  },
  {
    quest: pastQuest(
      2,
      2024,
      {
        title: 'Animal Farm',
        author: 'George Orwell',
        pages: 112,
        coverUrl: 'https://covers.openlibrary.org/b/id/7891013-L.jpg',
        description:
          'The animals take the farm. What happens next is the part everyone quotes and half of us misremember.',
        resources: [{ label: 'PDF (English)', url: 'https://t.me/bookquest_uz/61', kind: 'pdf' }]
      },
      { first: 'AirPods (2nd gen)', second: '500,000 so‘m', third: 'A stack of books' },
      287
    ),
    winner: { number: 3094, fullName: 'Jasur Toshmatov' }
  },
  {
    quest: pastQuest(
      1,
      2023,
      {
        title: 'The Little Prince',
        author: 'Antoine de Saint-Exupéry',
        pages: 96,
        coverUrl: 'https://covers.openlibrary.org/b/id/8114155-L.jpg',
        description:
          'A pilot crashes in the desert and meets a boy from an asteroid. It is a children’s book the way a mirror is a piece of glass.',
        resources: []
      },
      { first: 'A Kindle', second: '300,000 so‘m', third: 'A stack of books' },
      143
    ),
    winner: { number: 3011, fullName: 'Malika Yusupova' }
  }
];

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
  photoUrl: 'https://i.pravatar.cc/160?img=47',
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
