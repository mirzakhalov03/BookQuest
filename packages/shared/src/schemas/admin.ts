import { z } from 'zod';
import type { QuestPhase } from '../constants/quest.js';
import { bookResourceSchema } from './quest.js';

/**
 * Admin-editable content. `edition`, `year` and `participantCount` are absent
 * on purpose and the object is strict, so sending one is a loud 400 rather
 * than a silently ignored key: edition and year are identity, and the count is
 * owned by the registration path.
 */
const bookFields = {
  title: z.string().trim().min(1).max(200),
  author: z.string().trim().min(1).max(200),
  pages: z.number().int().positive().max(20_000),
  coverUrl: z.string().url().nullable(),
  description: z.string().trim().max(4000).nullable(),
  resources: z.array(bookResourceSchema).max(12)
};

const prizeFields = {
  first: z.string().trim().max(200).nullable(),
  second: z.string().trim().max(200).nullable(),
  third: z.string().trim().max(200).nullable()
};

const questDateFields = {
  opensAt: z.coerce.date(),
  readingDeadline: z.coerce.date(),
  quizOpensAt: z.coerce.date(),
  quizClosesAt: z.coerce.date(),
  resultsAt: z.coerce.date()
};

const quizMetaFields = {
  quizQuestionCount: z.number().int().positive().max(200).nullable(),
  quizDurationMinutes: z.number().int().positive().max(600).nullable()
};

export const updateQuestSchema = z
  .strictObject({
    book: z.strictObject(bookFields).partial().optional(),
    prizes: z.strictObject(prizeFields).partial().optional(),
    ...questDateFields,
    ...quizMetaFields
  })
  .partial()
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nothing to update.'
  });

export type UpdateQuestPayload = z.infer<typeof updateQuestSchema>;

export const createQuestSchema = z.strictObject({
  edition: z.number().int().positive().max(1000),
  year: z.number().int().min(2000).max(2200),
  book: z.strictObject({
    ...bookFields,
    coverUrl: bookFields.coverUrl.default(null),
    description: bookFields.description.default(null),
    resources: bookFields.resources.default([])
  }),
  prizes: z.strictObject(prizeFields).partial().optional(),
  ...questDateFields,
  quizQuestionCount: quizMetaFields.quizQuestionCount.default(null),
  quizDurationMinutes: quizMetaFields.quizDurationMinutes.default(null),
  /** Swap the current edition in the same transaction, so "created but not live" can't happen. */
  makeCurrent: z.boolean().default(false)
});

export type CreateQuestPayload = z.infer<typeof createQuestSchema>;

/** What the admin dashboard reads. */
export interface AdminStats {
  participants: number;
  registeredToday: number;
  quizSubmitted: number;
  phase: QuestPhase;
}
