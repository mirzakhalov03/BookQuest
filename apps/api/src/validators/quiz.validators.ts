import { z } from 'zod';
import {
  ATTEMPT_STATUSES,
  QUIZ_DISTRIBUTIONS,
  QUIZ_FLAGS,
  QUIZ_GROUP_COUNTS,
  QUIZ_MAX_QUESTIONS,
  createQuizSchema,
  putAttemptItemSchema,
  saveQuizSchema,
  voidAttemptSchema
} from '@bookquest/shared';
import { objectId } from './common.js';

export const quizIdParams = z.object({ id: objectId });
export const createQuizBody = createQuizSchema;
export const saveQuizBody = saveQuizSchema;

export const groupSizesQuery = z
  .object({
    distribution: z.enum(QUIZ_DISTRIBUTIONS),
    groups: z.coerce.number().int()
  })
  .refine(
    ({ distribution, groups }) =>
      groups >= QUIZ_GROUP_COUNTS[distribution].min && groups <= QUIZ_GROUP_COUNTS[distribution].max,
    { message: 'That group count does not fit this split.', path: ['groups'] }
  );
export type GroupSizesQuery = z.output<typeof groupSizesQuery>;

export const attemptItemParams = z.object({
  index: z.coerce.number().int().min(0).max(QUIZ_MAX_QUESTIONS - 1)
});
export type AttemptItemParams = z.output<typeof attemptItemParams>;
export const putAttemptItemBody = putAttemptItemSchema;

export const attemptsQuery = z.object({
  status: z.enum(ATTEMPT_STATUSES).optional(),
  flag: z.enum(QUIZ_FLAGS).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(200).default(50)
});
export type AttemptsQuery = z.output<typeof attemptsQuery>;
export const voidAttemptBody = voidAttemptSchema;
