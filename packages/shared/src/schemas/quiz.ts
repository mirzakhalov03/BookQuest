import { z } from 'zod';
import {
  ATTEMPT_STATUSES,
  ITEM_OUTCOMES,
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
  QUIZ_DISTRIBUTIONS,
  QUIZ_FLAGS,
  QUIZ_MAX_GROUPS,
  QUIZ_MAX_QUESTIONS,
  QUIZ_MCQ_OPTIONS,
  QUIZ_TEXT_LIMITS,
  QUIZ_TIME_LIMIT_SEC,
  TRUE_FALSE_OPTION_IDS,
  type QuestionDifficulty,
  type QuizDistribution
} from '../constants/quiz.js';

const objectIdString = z.string().regex(/^[a-f0-9]{24}$/i, 'Invalid id.');
const idString = z.string().min(1).max(32);
const isoString = z.string();
const timeLimitSec = z.number().int().min(QUIZ_TIME_LIMIT_SEC.min).max(QUIZ_TIME_LIMIT_SEC.max);

/* ── Content ────────────────────────────────────────────────────────────── */

export const quizOptionSchema = z.object({
  id: idString,
  text: z.string().max(QUIZ_TEXT_LIMITS.option)
});
export type QuizOption = z.infer<typeof quizOptionSchema>;

export const quizQuestionSchema = z.object({
  id: idString,
  type: z.enum(QUESTION_TYPES),
  prompt: z.string().max(QUIZ_TEXT_LIMITS.prompt),
  options: z.array(quizOptionSchema).max(QUIZ_MCQ_OPTIONS.max),
  correctOptionId: z.string().nullable(),
  timeLimitSec: timeLimitSec.nullable(),
  difficulty: z.enum(QUESTION_DIFFICULTIES),
  explanation: z.string().max(QUIZ_TEXT_LIMITS.explanation).nullable()
});
export type QuizQuestion = z.infer<typeof quizQuestionSchema>;

export const quizSettingsSchema = z.object({
  shuffleQuestions: z.boolean(),
  shuffleOptions: z.boolean(),
  defaultTimeLimitSec: timeLimitSec
});
export type QuizSettings = z.infer<typeof quizSettingsSchema>;

const title = z.string().trim().min(1).max(QUIZ_TEXT_LIMITS.title);
const description = z.string().trim().max(QUIZ_TEXT_LIMITS.description).nullable();

export const createQuizSchema = z.strictObject({
  title,
  description: description.default(null)
});
export type CreateQuizPayload = z.infer<typeof createQuizSchema>;

const saveQuizBase = z.strictObject({
  revision: z.number().int().min(0),
  title,
  description,
  settings: quizSettingsSchema,
  questions: z.array(quizQuestionSchema).max(QUIZ_MAX_QUESTIONS)
});

/** Structural rules only; completeness (empty prompt etc.) is allowed in a draft. */
export const saveQuizSchema = saveQuizBase.superRefine((quiz, ctx) => {
  const seen = new Set<string>();
  quiz.questions.forEach((q, i) => {
    if (seen.has(q.id)) {
      ctx.addIssue({ code: 'custom', path: ['questions', i, 'id'], message: 'Duplicate question id.' });
    }
    seen.add(q.id);

    const optionIds = q.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) {
      ctx.addIssue({ code: 'custom', path: ['questions', i, 'options'], message: 'Duplicate option id.' });
    }
    if (q.type === 'true_false' && optionIds.join() !== TRUE_FALSE_OPTION_IDS.join()) {
      ctx.addIssue({
        code: 'custom',
        path: ['questions', i, 'options'],
        message: 'True/false needs exactly the options true and false.'
      });
    }
  });
});
export type SaveQuizPayload = z.infer<typeof saveQuizSchema>;
export type QuizContent = Pick<SaveQuizPayload, 'settings' | 'questions'>;

export const quizCorrectionSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('key'),
    questionId: idString,
    correctOptionId: idString,
    note: z.string().trim().max(QUIZ_TEXT_LIMITS.voidReason).optional()
  }),
  z.strictObject({
    kind: z.literal('void'),
    questionId: idString,
    note: z.string().trim().max(QUIZ_TEXT_LIMITS.voidReason).optional()
  })
]);
export type QuizCorrectionPayload = z.infer<typeof quizCorrectionSchema>;

/** How many quizzes (groups) each distribution takes. Position in `quizIds` is the group. */
export const QUIZ_GROUP_COUNTS: Record<QuizDistribution, { min: number; max: number }> = {
  single: { min: 1, max: 1 },
  parity: { min: 2, max: 2 },
  random: { min: 2, max: QUIZ_MAX_GROUPS }
};

/** Here, not in the API, so the quest editor labels unsaved groups the same way. */
export function groupLabels(distribution: QuizDistribution, count: number): string[] {
  if (distribution === 'single') return ['Everyone'];
  if (distribution === 'parity') return ['Odd numbers', 'Even numbers'];
  return Array.from({ length: count }, (_, i) => `Group ${i + 1}`);
}

export const quizConfigInputSchema = z.strictObject({
  distribution: z.enum(QUIZ_DISTRIBUTIONS),
  quizIds: z.array(objectIdString).min(1).max(QUIZ_MAX_GROUPS)
});
export type QuizConfigInput = z.infer<typeof quizConfigInputSchema>;

export const putAttemptItemSchema = z.strictObject({
  optionId: idString,
  lock: z.boolean(),
  clientId: z.string().min(8).max(64),
  signals: z
    .strictObject({
      hiddenCount: z.number().int().min(0).max(1000),
      hiddenMs: z.number().int().min(0).max(3_600_000)
    })
    .optional()
});
export type PutAttemptItemPayload = z.infer<typeof putAttemptItemSchema>;

export const voidAttemptSchema = z.strictObject({
  reason: z.string().trim().min(1).max(QUIZ_TEXT_LIMITS.voidReason)
});
export type VoidAttemptPayload = z.infer<typeof voidAttemptSchema>;

/* ── Completeness & shape ───────────────────────────────────────────────── */

export function effectiveTimeLimitSec(question: QuizQuestion, settings: QuizSettings): number {
  return question.timeLimitSec ?? settings.defaultTimeLimitSec;
}

/**
 * Keyed by `questions` or `questions.${i}.prompt|options|correctOptionId`.
 * Same pattern as `findQuestDateIssues`: the server gates on it and the editor
 * runs it for instant feedback.
 */
export function findQuizIssues(content: QuizContent): Record<string, string> | null {
  const issues: Record<string, string> = {};

  if (content.questions.length === 0) issues.questions = 'Add at least one question.';

  content.questions.forEach((q, i) => {
    const key = `questions.${i}`;
    if (q.prompt.trim().length === 0) issues[`${key}.prompt`] = 'Write the question.';

    if (q.type === 'mcq') {
      const texts = q.options.map((o) => o.text.trim().toLowerCase());
      if (q.options.length < QUIZ_MCQ_OPTIONS.min || q.options.length > QUIZ_MCQ_OPTIONS.max) {
        issues[`${key}.options`] = `Use ${QUIZ_MCQ_OPTIONS.min}–${QUIZ_MCQ_OPTIONS.max} options.`;
      } else if (texts.some((t) => t.length === 0)) {
        issues[`${key}.options`] = 'Every option needs text.';
      } else if (new Set(texts).size !== texts.length) {
        issues[`${key}.options`] = 'Options must be different from each other.';
      }
    }

    if (q.correctOptionId === null || !q.options.some((o) => o.id === q.correctOptionId)) {
      issues[`${key}.correctOptionId`] = 'Mark the correct answer.';
    }
  });

  return Object.keys(issues).length > 0 ? issues : null;
}

export type QuizShape = {
  questionCount: number;
  totalSeconds: number;
  difficulty: Record<QuestionDifficulty, number>;
};

/** Variants of one quest must match in shape so no group gets an easier or longer quiz (§5.6). */
export function quizShape(content: QuizContent): QuizShape {
  const difficulty: Record<QuestionDifficulty, number> = { easy: 0, medium: 0, hard: 0 };
  let totalSeconds = 0;
  for (const q of content.questions) {
    difficulty[q.difficulty] += 1;
    totalSeconds += effectiveTimeLimitSec(q, content.settings);
  }
  return { questionCount: content.questions.length, totalSeconds, difficulty };
}

export function sameShape(a: QuizShape, b: QuizShape): boolean {
  return (
    a.questionCount === b.questionCount &&
    a.totalSeconds === b.totalSeconds &&
    QUESTION_DIFFICULTIES.every((d) => a.difficulty[d] === b.difficulty[d])
  );
}

/* ── Admin DTOs (§8.2) ──────────────────────────────────────────────────── */

const attachmentSchema = z.object({
  questEdition: z.number().int(),
  groupLabel: z.string()
});

export const quizSummaryAdminSchema = z.object({
  id: z.string(),
  title: z.string(),
  questionCount: z.number().int().nonnegative(),
  totalSeconds: z.number().int().nonnegative(),
  difficultyMix: z.object({
    easy: z.number().int().nonnegative(),
    medium: z.number().int().nonnegative(),
    hard: z.number().int().nonnegative()
  }),
  isComplete: z.boolean(),
  issueCount: z.number().int().nonnegative(),
  attachment: attachmentSchema.nullable(),
  usedIn: z.array(z.number().int()),
  locked: z.boolean(),
  revision: z.number().int().nonnegative(),
  updatedAt: isoString
});
export type QuizSummaryAdmin = z.infer<typeof quizSummaryAdminSchema>;

export const quizCorrectionEntrySchema = z.object({
  questionId: z.string(),
  kind: z.enum(['key', 'void']),
  from: z.string().nullable(),
  to: z.string().nullable(),
  note: z.string().nullable(),
  by: z.string(), // admin user id
  at: isoString
});
export type QuizCorrectionEntry = z.infer<typeof quizCorrectionEntrySchema>;

export const quizAdminSchema = z.object({
  ...saveQuizBase.shape,
  id: z.string(),
  issues: z.record(z.string(), z.string()).nullable(),
  locked: z.boolean(),
  attachment: attachmentSchema.nullable(),
  usedIn: z.array(z.number().int()), // quest editions that reference it
  corrections: z.array(quizCorrectionEntrySchema),
  voidedQuestionIds: z.array(z.string()),
  updatedAt: isoString
});
export type QuizAdmin = z.infer<typeof quizAdminSchema>;

/** `POST /admin/quizzes/:id/corrections`: the corrected quiz and how many attempts were re-scored. */
export type QuizCorrectionResult = { quiz: QuizAdmin; rescored: number };

/* ── Participant DTOs (§8.1) ────────────────────────────────────────────── */
// Strict objects and no answer-bearing fields: these types cannot carry
// `correctOptionId`, `isCorrect`, `explanation` or `difficulty`.

export const QUIZ_OVERVIEW_STATES = [
  'no_quest',
  'not_registered',
  'not_configured',
  'upcoming',
  'open',
  'in_progress',
  'completed',
  'missed',
  'voided',
  'results'
] as const;
export type QuizOverviewState = (typeof QUIZ_OVERVIEW_STATES)[number];

export const quizOverviewSchema = z.strictObject({
  state: z.enum(QUIZ_OVERVIEW_STATES),
  serverNow: isoString,
  window: z.strictObject({ opensAt: isoString, closesAt: isoString, resultsAt: isoString }).nullable(),
  quiz: z
    .strictObject({
      title: z.string(),
      description: z.string().nullable(),
      questionCount: z.number().int().nonnegative(),
      totalSeconds: z.number().int().nonnegative()
    })
    .nullable(),
  attempt: z
    .strictObject({
      status: z.enum(ATTEMPT_STATUSES),
      answered: z.number().int().nonnegative(),
      total: z.number().int().nonnegative(),
      score: z.number().int().nullable(),
      durationMs: z.number().int().nullable(),
      voidReason: z.string().nullable(),
      reviewAvailable: z.boolean()
    })
    .nullable()
});
export type QuizOverview = z.infer<typeof quizOverviewSchema>;

export const attemptQuestionSchema = z.strictObject({
  index: z.number().int().nonnegative(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  options: z.array(quizOptionSchema),
  timeLimitMs: z.number().int().positive(),
  servedAt: isoString,
  deadlineAt: isoString,
  selectedOptionId: z.string().nullable()
});
export type AttemptQuestion = z.infer<typeof attemptQuestionSchema>;

export const ATTEMPT_PHASES = ['ready', 'question', 'between', 'completed', 'voided'] as const;
export type AttemptPhase = (typeof ATTEMPT_PHASES)[number];

export const attemptStateSchema = z.strictObject({
  attemptId: z.string(),
  status: z.enum(ATTEMPT_STATUSES),
  phase: z.enum(ATTEMPT_PHASES),
  position: z.strictObject({ index: z.number().int().nonnegative(), total: z.number().int().nonnegative() }),
  question: attemptQuestionSchema.nullable(),
  lastAction: z
    .strictObject({
      accepted: z.boolean(),
      reason: z.enum(['time_up', 'already_locked']).optional()
    })
    .optional(),
  result: z
    .strictObject({
      score: z.number().int(),
      total: z.number().int(),
      durationMs: z.number().int()
    })
    .nullable(),
  windowClosesAt: isoString,
  serverNow: isoString
});
export type AttemptState = z.infer<typeof attemptStateSchema>;

/** Only served after `quizClosesAt`, so it may carry the answer key. */
export const attemptReviewSchema = z.strictObject({
  items: z.array(
    z.strictObject({
      index: z.number().int().nonnegative(),
      prompt: z.string(),
      options: z.array(quizOptionSchema),
      selectedOptionId: z.string().nullable(),
      correctOptionId: z.string(),
      outcome: z.enum(ITEM_OUTCOMES).nullable(),
      isCorrect: z.boolean().nullable(),
      voided: z.boolean(),
      elapsedMs: z.number().int().nullable(),
      explanation: z.string().nullable()
    })
  ),
  score: z.number().int(),
  total: z.number().int(),
  durationMs: z.number().int()
});
export type AttemptReview = z.infer<typeof attemptReviewSchema>;

/* ── Live monitor & attempts (§8.2) ─────────────────────────────────────── */

export const quizLiveStatsSchema = z.object({
  groups: z.array(
    z.object({
      index: z.number().int().nonnegative(),
      label: z.string(),
      quizTitle: z.string(),
      assigned: z.number().int().nonnegative(),
      started: z.number().int().nonnegative(),
      inProgress: z.number().int().nonnegative(),
      completed: z.number().int().nonnegative(),
      avgScore: z.number().nullable(),
      avgDurationMs: z.number().nullable()
    })
  ),
  updatedAt: isoString
});
export type QuizLiveStats = z.infer<typeof quizLiveStatsSchema>;

export const attemptRowSchema = z.object({
  id: z.string(),
  participant: z.object({ number: z.number().int(), fullName: z.string() }),
  groupLabel: z.string(),
  status: z.enum(ATTEMPT_STATUSES),
  answered: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  score: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  flags: z.array(z.enum(QUIZ_FLAGS)),
  startedAt: isoString,
  completedAt: isoString.nullable()
});
export type AttemptRow = z.infer<typeof attemptRowSchema>;

const attemptAdminItemSchema = z.object({
  index: z.number().int().nonnegative(),
  questionId: z.string(),
  type: z.enum(QUESTION_TYPES),
  prompt: z.string(),
  explanation: z.string().nullable(),
  options: z.array(quizOptionSchema),
  correctOptionId: z.string(),
  voided: z.boolean(),
  difficulty: z.enum(QUESTION_DIFFICULTIES),
  timeLimitMs: z.number().int(),
  servedAt: isoString.nullable(),
  deadlineAt: isoString.nullable(),
  selectedOptionId: z.string().nullable(),
  selectedAt: isoString.nullable(),
  lockedAt: isoString.nullable(),
  outcome: z.enum(ITEM_OUTCOMES).nullable(),
  isCorrect: z.boolean().nullable(),
  elapsedMs: z.number().int().nullable(),
  signals: z.object({ hiddenCount: z.number().int(), hiddenMs: z.number().int() })
});

export const attemptAdminSchema = attemptRowSchema.extend({
  quizId: z.string(),
  quizTitle: z.string(),
  quizRevision: z.number().int(),
  finalizedBy: z.enum(['participant', 'sweep', 'ranking']).nullable(),
  clientIdCount: z.number().int().nonnegative(),
  voidReason: z.string().nullable(),
  voidedAt: isoString.nullable(),
  items: z.array(attemptAdminItemSchema)
});
export type AttemptAdmin = z.infer<typeof attemptAdminSchema>;
