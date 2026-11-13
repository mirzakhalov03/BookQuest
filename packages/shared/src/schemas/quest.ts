import { z } from 'zod';
import { BOOK_RESOURCE_KINDS, QUEST_PHASES } from '../constants/quest.js';
import { QUIZ_RESULTS_BUFFER_MS } from '../constants/quiz.js';

// `.url()` alone admits javascript: and data: links, which participants would tap. A regex because shared has no URL global in its types.
const isHttpUrl = (value: string): boolean => /^https?:\/\//i.test(value);

export const bookResourceSchema = z.object({
  label: z.string().min(1).max(80),
  url: z.string().url().refine(isHttpUrl, 'Use a full http(s) link.'),
  kind: z.enum(BOOK_RESOURCE_KINDS)
});

export type BookResource = z.infer<typeof bookResourceSchema>;

export const bookSchema = z.object({
  title: z.string(),
  author: z.string(),
  pages: z.number().int().positive(),
  coverUrl: z.string().url().nullable(),
  description: z.string().nullable(),
  resources: z.array(bookResourceSchema)
});

export type Book = z.infer<typeof bookSchema>;

/**
 * Free text on purpose. "AirPods Pro" and "500,000 so'm" need no schema, and a
 * structure invented before anyone has typed a real prize would be wrong.
 */
export const prizesSchema = z.object({
  first: z.string().nullable(),
  second: z.string().nullable(),
  third: z.string().nullable(),
  fourth: z.string().nullable(),
  fifth: z.string().nullable(),
  /** One photo of all the prizes together; without it the page falls back to the podium. */
  photoUrl: z.string().url().nullable()
});

export type Prizes = z.infer<typeof prizesSchema>;

/**
 * One year's competition. Every date is an ISO string over the wire; the
 * client turns them into Date objects at the edge, so nothing downstream has
 * to wonder which representation it is holding.
 */
export const questSchema = z.object({
  id: z.string(),
  edition: z.number().int().positive(),
  year: z.number().int(),
  phase: z.enum(QUEST_PHASES),
  /** False while the admin keeps the book a surprise; `book` is then withheld entirely. */
  bookRevealed: z.boolean(),
  book: bookSchema.nullable(),
  prizes: prizesSchema,
  opensAt: z.string(),
  readingDeadline: z.string(),
  quizOpensAt: z.string(),
  quizClosesAt: z.string(),
  resultsAt: z.string(),
  /** Derived from the attached quiz; null until one is attached. */
  quiz: z
    .object({
      questionCount: z.number().int().nonnegative(),
      totalSeconds: z.number().int().nonnegative()
    })
    .nullable(),
  participantCount: z.number().int().nonnegative()
});

export type Quest = z.infer<typeof questSchema>;

export function isResultsOut(quest: { resultsAt: string }, now = new Date()): boolean {
  return now >= new Date(quest.resultsAt);
}

/** The archive list. Enough to render a card, nothing more. */
export const questSummarySchema = z.object({
  id: z.string(),
  edition: z.number().int().positive(),
  year: z.number().int(),
  bookTitle: z.string(),
  bookAuthor: z.string(),
  coverUrl: z.string().nullable(),
  participantCount: z.number().int().nonnegative(),
  prizes: prizesSchema,
  winner: z.object({ number: z.number().int(), fullName: z.string() }).nullable()
});

export type QuestSummary = z.infer<typeof questSummarySchema>;

/* ── Date ordering ──────────────────────────────────────────────────────── */

export const QUEST_DATE_FIELDS = [
  'opensAt',
  'readingDeadline',
  'quizOpensAt',
  'quizClosesAt',
  'resultsAt'
] as const;

export type QuestDateField = (typeof QUEST_DATE_FIELDS)[number];
export type QuestDates = Record<QuestDateField, Date>;

/**
 * `opensAt < readingDeadline <= quizOpensAt < quizClosesAt <= resultsAt`.
 * `requireResultsBuffer` also demands `resultsAt >= quizClosesAt + QUIZ_RESULTS_BUFFER_MS`;
 * it's opt-in so quests saved before the rule can still be edited elsewhere (§13.6).
 *
 * A partial admin edit only makes sense against the *merged* result, so this is
 * a plain function the service calls after merging rather than a zod refinement
 * on the request body. The form runs the same function for instant feedback.
 */
export function findQuestDateIssues(
  dates: QuestDates,
  options: { requireResultsBuffer?: boolean } = {}
): Record<string, string> | null {
  const issues: Record<string, string> = {};
  const add = (field: QuestDateField, message: string) => {
    issues[field] ??= message;
  };

  if (!(dates.opensAt < dates.readingDeadline)) {
    add('readingDeadline', 'Reading has to end after the quest opens.');
  }
  if (dates.quizOpensAt < dates.readingDeadline) {
    add('quizOpensAt', 'The quiz cannot open before the reading deadline.');
  }
  if (!(dates.quizOpensAt < dates.quizClosesAt)) {
    add('quizClosesAt', 'The quiz has to close after it opens.');
  }
  if (dates.resultsAt < dates.quizClosesAt) {
    add('resultsAt', 'Results cannot be published before the quiz closes.');
  }
  if (
    options.requireResultsBuffer &&
    dates.resultsAt.getTime() < dates.quizClosesAt.getTime() + QUIZ_RESULTS_BUFFER_MS
  ) {
    add('resultsAt', 'Results must be at least 5 minutes after the quiz closes.');
  }

  return Object.keys(issues).length > 0 ? issues : null;
}
