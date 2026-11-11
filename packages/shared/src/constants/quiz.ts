/** Grace after a deadline during which a late lock is still accepted (network latency). */
export const QUIZ_ANSWER_GRACE_MS = 2000;
export const QUIZ_MAX_QUESTIONS = 100;
export const QUIZ_TIME_LIMIT_SEC = { min: 5, max: 300, default: 30 } as const;
export const QUIZ_MCQ_OPTIONS = { min: 2, max: 6 } as const;
/** Time after `quizClosesAt` the sweep waits before ranking, so in-flight attempts finalise. */
export const QUIZ_RESULTS_BUFFER_MS = 300_000;
export const QUIZ_MAX_GROUPS = 4;

export const QUIZ_TEXT_LIMITS = {
  title: 120,
  description: 2000,
  prompt: 500,
  option: 200,
  explanation: 500,
  voidReason: 300
} as const;

export const QUESTION_TYPES = ['true_false', 'mcq'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const QUESTION_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type QuestionDifficulty = (typeof QUESTION_DIFFICULTIES)[number];

export const QUIZ_DISTRIBUTIONS = ['single', 'parity', 'random'] as const;
export type QuizDistribution = (typeof QUIZ_DISTRIBUTIONS)[number];

export const TRUE_FALSE_OPTION_IDS = ['true', 'false'] as const;

/** Advisory suspicion flags computed at finalise; never an automatic penalty. */
export const QUIZ_FLAGS = ['multi_client', 'fast', 'hidden'] as const;
export type QuizFlag = (typeof QUIZ_FLAGS)[number];

export const ATTEMPT_STATUSES = ['in_progress', 'completed', 'voided'] as const;
export type AttemptStatus = (typeof ATTEMPT_STATUSES)[number];

export const ITEM_OUTCOMES = ['locked', 'auto', 'timeout', 'unserved'] as const;
export type ItemOutcome = (typeof ITEM_OUTCOMES)[number];

/** Machine-readable `error.reason` values the quiz API returns on 409s. */
export const QUIZ_ERROR_REASONS = [
  'stale',
  'quiz_locked',
  'window_not_open',
  'window_closed',
  'not_configured',
  'already_completed',
  'voided',
  'already_locked'
] as const;
export type QuizErrorReason = (typeof QUIZ_ERROR_REASONS)[number];
