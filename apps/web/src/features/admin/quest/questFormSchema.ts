import { z } from 'zod';
import { BOOK_RESOURCE_KINDS, QUIZ_DISTRIBUTIONS, QUIZ_GROUP_COUNTS, findQuestDateIssues } from '@bookquest/shared';
import { parseLocal } from '../dates';
import { formDates, isValidResourceUrl, type QuestFormState } from './questForm';
import { getT, type Messages } from '@/i18n';

type SchemaWords = Messages['adminQuest']['schema'];

/** Resolved when validation runs, not when the module loads, so messages follow the current language. */
const msg = (pick: (t: SchemaWords) => string) => ({ error: () => pick(getT().adminQuest.schema) });

const required = (missing: (t: SchemaWords) => string, max: number, tooLong: (t: SchemaWords) => string) =>
  z
    .string()
    .refine((value) => value.trim() !== '', msg(missing))
    .refine((value) => value.trim().length <= max, msg(tooLong));

const wholeNumber = (value: string, max: number) =>
  /^\d+$/.test(value.trim()) && Number(value) >= 1 && Number(value) <= max;

const prize = z.string().refine((value) => value.trim().length <= 200, msg((t) => t.prizeTooLong));
const quizConfig = z
  .object({ distribution: z.enum(QUIZ_DISTRIBUTIONS), quizIds: z.array(z.string()) })
  .nullable()
  .superRefine((config, ctx) => {
    if (!config) return;
    const { min, max } = QUIZ_GROUP_COUNTS[config.distribution];
    const picked = config.quizIds.filter((id) => id !== '');
    const t = getT().adminQuest.schema;
    let message: string | null = null;
    if (config.quizIds.length < min || config.quizIds.length > max) message = t.groupsMismatch;
    else if (picked.length < config.quizIds.length) message = t.pickEveryGroup;
    else if (new Set(picked).size !== picked.length) message = t.pickDifferent;
    if (message) ctx.addIssue({ code: 'custom', message });
  });

const date = z.string().refine((value) => parseLocal(value) !== null, msg((t) => t.pickDate));

/**
 * The client mirror of the API's limits, over the form's string values. The
 * server stays the authority; this only makes the answer instant.
 */
export const questFormSchema = z
  .object({
    book: z.object({
      title: required((t) => t.titleRequired, 200, (t) => t.titleTooLong),
      author: required((t) => t.authorRequired, 200, (t) => t.authorTooLong),
      pages: z.string().refine((value) => wholeNumber(value, 20_000), msg((t) => t.pages)),
      coverUrl: z.string(),
      description: z.string().refine((value) => value.trim().length <= 4000, msg((t) => t.descriptionTooLong)),
      resources: z
        .array(
          z.object({
            label: required((t) => t.linkName, 80, (t) => t.linkNameTooLong),
            url: z.string().refine((value) => isValidResourceUrl(value.trim()), msg((t) => t.badUrl)),
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
    // Each field fails for one reason on the client, so the field names the message.
    const order: Partial<Record<string, string>> = getT().adminQuest.dates.order;
    for (const [field, message] of Object.entries(issues ?? {})) {
      ctx.addIssue({ code: 'custom', path: ['dates', field], message: order[field] ?? message });
    }
  }) satisfies z.ZodType<QuestFormState>;
