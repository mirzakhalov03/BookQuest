import { z } from 'zod';
import { BOOK_RESOURCE_KINDS, QUIZ_DISTRIBUTIONS, QUIZ_GROUP_COUNTS, findQuestDateIssues } from '@bookquest/shared';
import { parseLocal } from '../dates';
import { formDates, isValidResourceUrl, type QuestFormState } from './questForm';

const required = (message: string, max: number, tooLong: string) =>
  z
    .string()
    .refine((value) => value.trim() !== '', message)
    .refine((value) => value.trim().length <= max, tooLong);

const wholeNumber = (value: string, max: number) =>
  /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= max;

const prize = z.string().refine((value) => value.trim().length <= 200, 'Keep it under 200 characters.');
const quizConfig = z
  .object({ distribution: z.enum(QUIZ_DISTRIBUTIONS), quizIds: z.array(z.string()) })
  .nullable()
  .superRefine((config, ctx) => {
    if (!config) return;
    const { min, max } = QUIZ_GROUP_COUNTS[config.distribution];
    const picked = config.quizIds.filter((id) => id !== '');
    let message: string | null = null;
    if (config.quizIds.length < min || config.quizIds.length > max) message = 'That many groups doesn’t fit this split.';
    else if (picked.length < config.quizIds.length) message = 'Pick a quiz for every group.';
    else if (new Set(picked).size !== picked.length) message = 'Pick a different quiz for each group.';
    if (message) ctx.addIssue({ code: 'custom', message });
  });

const date = z.string().refine((value) => parseLocal(value) !== null, 'Pick a date and time.');

/**
 * The client mirror of the API's limits, over the form's string values. The
 * server stays the authority; this only makes the answer instant.
 */
export const questFormSchema = z
  .object({
    book: z.object({
      title: required('Give the book a title.', 200, 'Keep the title under 200 characters.'),
      author: required('Who wrote it?', 200, 'Keep the author under 200 characters.'),
      pages: z.string().refine((value) => wholeNumber(value, 20_000), 'Whole pages, 1 to 20,000.'),
      coverUrl: z.string(),
      description: z.string().refine((value) => value.trim().length <= 4000, 'Keep it under 4,000 characters.'),
      resources: z
        .array(
          z.object({
            label: required('Name this link.', 80, 'Keep the name under 80 characters.'),
            url: z.string().refine((value) => isValidResourceUrl(value.trim()), 'That doesn’t look like a full URL.'),
            kind: z.enum(BOOK_RESOURCE_KINDS)
          })
        )
        .max(12)
    }),
    prizes: z.object({ first: prize, second: prize, third: prize }),
    dates: z.object({
      opensAt: date,
      readingDeadline: date,
      quizOpensAt: date,
      quizClosesAt: date,
      resultsAt: date
    }),
    quizConfig
  })
  .superRefine((values, ctx) => {
    // Ordering only means something once all five parse; "Pick a date" covers the rest.
    if (Object.values(values.dates).some((value) => parseLocal(value) === null)) return;
    const issues = findQuestDateIssues(formDates(values));
    for (const [field, message] of Object.entries(issues ?? {})) {
      ctx.addIssue({ code: 'custom', path: ['dates', field], message });
    }
  }) satisfies z.ZodType<QuestFormState>;
