/** Grace after a deadline during which a late answer is still accepted: a tap made in time must never lose to a slow network. */
export const QUIZ_ANSWER_GRACE_MS = 10_000;
/**
 * Most a locked answer's time can drop below the server's own measure when the phone reports its
 * on-screen time: refunds network travel to honest users, caps what a forged report can gain.
 */
export const QUIZ_LATENCY_REFUND_MAX_MS = 2000;
export const QUIZ_MAX_QUESTIONS = 100;
export const QUIZ_TIME_LIMIT_SEC = { min: 5, max: 300, default: 30 } as const;
export const QUIZ_MCQ_OPTIONS = { min: 2, max: 6 } as const;
/** Time after `quizClosesAt` the sweep waits before ranking, so in-flight attempts finalise. */
export const QUIZ_RESULTS_BUFFER_MS = 300_000;
export const QUIZ_MAX_GROUPS = 4;
/** Corrections and voids stop this long before `resultsAt`, so no re-score is mid-run when ranks freeze. */
export const QUIZ_RESCORE_FREEZE_MS = 60_000;

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
export const QUIZ_FLAGS = ['multi_client', 'fast', 'hidden', 'refund_capped'] as const;
export type QuizFlag = (typeof QUIZ_FLAGS)[number];

/** Shared so the admin UI and the Telegram answer sheet say the same thing. */
export const QUIZ_FLAG_LABEL: Record<QuizFlag, string> = {
  multi_client: 'Many devices',
  fast: 'Fast',
  hidden: 'Left the app',
  refund_capped: 'Time claims capped'
};

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
  'already_locked',
  'results_imminent'
] as const;
export type QuizErrorReason = (typeof QUIZ_ERROR_REASONS)[number];
