import {
  QUIZ_ANSWER_GRACE_MS as G,
  QUIZ_LATENCY_REFUND_MAX_MS,
  effectiveTimeLimitSec,
  putAttemptItemSchema,
  type AttemptReview,
  type AttemptState,
  type QuizAdmin,
  type QuizOverview,
  type QuizOverviewState,
  type SessionUser
} from '@bookquest/shared';
import { QuizFailure, getQuiz, listQuizzes } from './quiz';
import { getState, updateState, type MockState } from './store';

/**
 * The participant quiz, served locally with the API's settle rules,
 * simplified: one attempt per browser tab's mock world, no variants, no
 * shuffling. Enough to click through every overview state and play end to end.
 */

interface MockItem {
  type: QuizAdmin['questions'][number]['type'];
  prompt: string;
  options: { id: string; text: string }[];
  correctOptionId: string | null;
  timeLimitMs: number;
  servedAt: number | null;
  deadlineAt: number | null;
  selectedOptionId: string | null;
  lockedAt: number | null;
  clientElapsedMs: number | null;
  outcome: 'locked' | 'auto' | 'timeout' | 'unserved' | null;
}

export interface MockAttempt {
  id: string;
  status: 'in_progress' | 'completed' | 'voided';
  cursor: number;
  items: MockItem[];
  startedAt: number;
  completedAt: number | null;
  voidReason: string | null;
}

export type MockQuizState = 'upcoming' | 'open' | 'in_progress' | 'completed' | 'missed' | 'voided';

/* ── Content ────────────────────────────────────────────────────────────── */

/** The configured quiz, else the first complete one in the library. */
function sourceQuiz(state: MockState): QuizAdmin | null {
  const configured = state.quizConfig?.quizIds[0];
  if (configured) return getQuiz(configured);
  const first = listQuizzes().find((quiz) => quiz.isComplete);
  return first ? getQuiz(first.id) : null;
}

function buildItems(quiz: QuizAdmin): MockItem[] {
  return quiz.questions.map((question) => ({
    type: question.type,
    prompt: question.prompt,
    options: question.options.map(({ id, text }) => ({ id, text })),
    correctOptionId: question.correctOptionId,
    timeLimitMs: effectiveTimeLimitSec(question, quiz.settings) * 1000,
    servedAt: null,
    deadlineAt: null,
    selectedOptionId: null,
    lockedAt: null,
    clientElapsedMs: null,
    outcome: null
  }));
}

export function newAttempt(quiz: QuizAdmin, now = Date.now()): MockAttempt {
  return {
    id: `mock-attempt-${now.toString(36)}`,
    status: 'in_progress',
    cursor: 0,
    items: buildItems(quiz),
    startedAt: now,
    completedAt: null,
    voidReason: null
  };
}

/* ── Settle (same rules as the API, §10.2) ──────────────────────────────── */

const window_ = (state: MockState) => ({
  opensAt: Date.parse(state.quest.quizOpensAt),
  closesAt: Date.parse(state.quest.quizClosesAt),
  resultsAt: Date.parse(state.quest.resultsAt)
});

const isLive = (item: MockItem | undefined, now: number): item is MockItem =>
  !!item && item.servedAt !== null && item.lockedAt === null && item.outcome === null && now <= item.deadlineAt! + G;

/** Same clamp as the API's `lockedElapsed`. */
function elapsed(item: MockItem): number {
  if (item.outcome !== 'locked' || item.lockedAt === null || item.servedAt === null) return item.timeLimitMs;
  const server = Math.max(0, item.lockedAt - item.servedAt);
  const claimed = item.clientElapsedMs;
  const counted = claimed === null ? server : Math.min(server, Math.max(server - QUIZ_LATENCY_REFUND_MAX_MS, claimed));
  return Math.min(counted, item.timeLimitMs);
}

function score(attempt: MockAttempt) {
  const answered = attempt.items.filter((item) => item.outcome === 'locked' || item.outcome === 'auto');
  return {
    score: answered.filter((item) => item.selectedOptionId === item.correctOptionId).length,
    total: attempt.items.length,
    durationMs: attempt.items.reduce((sum, item) => sum + elapsed(item), 0),
    answered: answered.length
  };
}

/** `graceMs` 0 when the client asked to move on (`/next`), as the API does. */
function settle(attempt: MockAttempt, closesAt: number, now: number, graceMs = G): void {
  if (attempt.status !== 'in_progress') return;
  const closed = now >= closesAt + G;
  for (;;) {
    const item = attempt.items[attempt.cursor];
    if (!item) {
      attempt.status = 'completed';
      attempt.completedAt = now;
      return;
    }
    const open = item.servedAt !== null && item.outcome === null && item.lockedAt === null;
    if (open && (closed || now > item.deadlineAt! + graceMs)) {
      item.outcome = item.selectedOptionId ? 'auto' : 'timeout';
      attempt.cursor += 1;
      continue;
    }
    if (closed && item.servedAt === null) {
      for (const rest of attempt.items.slice(attempt.cursor)) rest.outcome = 'unserved';
      attempt.cursor = attempt.items.length;
      continue;
    }
    return;
  }
}

function toState(attempt: MockAttempt, closesAt: number, now: number, lastAction?: AttemptState['lastAction']): AttemptState {
  const item = attempt.items[attempt.cursor];
  const live = attempt.status === 'in_progress' && isLive(item, now);
  const phase: AttemptState['phase'] =
    attempt.status === 'voided'
      ? 'voided'
      : attempt.status === 'completed'
        ? 'completed'
        : live
          ? 'question'
          : attempt.cursor === 0 && attempt.items[0]?.servedAt === null
            ? 'ready'
            : 'between';
  const totals = score(attempt);
  const published = now >= window_(getState()).resultsAt;
  return {
    attemptId: attempt.id,
    status: attempt.status,
    phase,
    position: { index: attempt.cursor, total: attempt.items.length },
    question: live
      ? {
          index: attempt.cursor,
          type: item.type,
          prompt: item.prompt,
          options: item.options,
          timeLimitMs: item.timeLimitMs,
          servedAt: new Date(item.servedAt!).toISOString(),
          deadlineAt: new Date(item.deadlineAt!).toISOString(),
          selectedOptionId: item.selectedOptionId
        }
      : null,
    ...(lastAction ? { lastAction } : {}),
    result: attempt.status === 'completed' && published ? { score: totals.score, total: totals.total, durationMs: totals.durationMs } : null,
    windowClosesAt: new Date(closesAt).toISOString(),
    serverNow: new Date(now).toISOString()
  };
}

/* ── Handlers ───────────────────────────────────────────────────────────── */

function requireRegistered(user: SessionUser): MockState {
  const state = getState();
  if (!state.questRunning) throw new QuizFailure(404, 'not_found', 'No quiz is scheduled right now.');
  if (!user.participant) throw new QuizFailure(404, 'not_found', 'You have not registered for this quest yet.');
  return state;
}

/** Settles, persists, and hands the attempt to `run`; every handler goes through here. */
function withAttempt<T>(user: SessionUser, run: (attempt: MockAttempt, closesAt: number, now: number) => T): T {
  const state = requireRegistered(user);
  if (!state.quizAttempt) throw new QuizFailure(404, 'not_found', 'You have not started the quiz yet.');
  const now = Date.now();
  const { closesAt } = window_(state);
  let out!: T;
  updateState((draft) => {
    const attempt = draft.quizAttempt!;
    settle(attempt, closesAt, now);
    out = run(attempt, closesAt, now);
    settle(attempt, closesAt, now);
  });
  return out;
}

export function quizOverview(user: SessionUser): QuizOverview {
  const state = getState();
  const now = Date.now();
  const serverNow = new Date(now).toISOString();
  if (!state.questRunning) return { state: 'no_quest', serverNow, window: null, quiz: null, attempt: null };

  const { opensAt, closesAt, resultsAt } = window_(state);
  const quizWindow = { opensAt: state.quest.quizOpensAt, closesAt: state.quest.quizClosesAt, resultsAt: state.quest.resultsAt };
  if (!user.participant) return { state: 'not_registered', serverNow, window: quizWindow, quiz: null, attempt: null };

  if (state.quizAttempt) updateState((draft) => settle(draft.quizAttempt!, closesAt, now));
  const attempt = getState().quizAttempt ?? null;
  const source = sourceQuiz(state);
  const totals = attempt ? score(attempt) : null;

  let overviewState: QuizOverviewState;
  if (attempt?.status === 'voided') overviewState = 'voided';
  else if (now >= resultsAt) overviewState = 'results';
  else if (attempt?.status === 'completed') overviewState = totals!.answered > 0 ? 'completed' : 'missed';
  else if (attempt) overviewState = 'in_progress';
  else if (!source) overviewState = 'not_configured';
  else if (now < opensAt) overviewState = 'upcoming';
  else if (now < closesAt) overviewState = 'open';
  else overviewState = 'missed';

  const items = attempt?.items ?? (source ? buildItems(source) : []);
  return {
    state: overviewState,
    serverNow,
    window: quizWindow,
    quiz: source
      ? {
          title: source.title,
          description: source.description,
          questionCount: items.length,
          totalSeconds: Math.round(items.reduce((sum, item) => sum + item.timeLimitMs, 0) / 1000)
        }
      : null,
    attempt:
      attempt && totals
        ? {
            status: attempt.status,
            answered: totals.answered,
            total: totals.total,
            score: attempt.status === 'completed' && now >= resultsAt ? totals.score : null,
            durationMs: attempt.status === 'completed' && now >= resultsAt ? totals.durationMs : null,
            voidReason: attempt.voidReason,
            reviewAvailable: attempt.status === 'completed' && now >= resultsAt
          }
        : null
  };
}

export function getReview(user: SessionUser): AttemptReview {
  const state = requireRegistered(user);
  const attempt = state.quizAttempt;
  if (Date.now() < window_(state).resultsAt) throw new QuizFailure(404, 'not_found', 'Answers are shown once results are announced.');
  if (attempt?.status !== 'completed') throw new QuizFailure(404, 'not_found', 'There is no completed attempt to review.');
  const totals = score(attempt);
  return {
    items: attempt.items.map((item, index) => ({
      index,
      prompt: item.prompt,
      options: item.options,
      selectedOptionId: item.selectedOptionId,
      correctOptionId: item.correctOptionId ?? '',
      outcome: item.outcome,
      isCorrect: item.outcome === 'locked' || item.outcome === 'auto' ? item.selectedOptionId === item.correctOptionId : false,
      voided: false,
      elapsedMs: elapsed(item),
      explanation: null
    })),
    score: totals.score,
    total: totals.total,
    durationMs: totals.durationMs
  };
}

export function startAttempt(user: SessionUser): { state: AttemptState; created: boolean } {
  const state = requireRegistered(user);
  if (state.quizAttempt) {
    if (state.quizAttempt.status === 'completed') throw new QuizFailure(409, 'conflict', 'You have already completed the quiz.', 'already_completed');
    if (state.quizAttempt.status === 'voided') throw new QuizFailure(409, 'conflict', 'Your attempt was withdrawn by the organisers.', 'voided');
    return { state: getAttempt(user), created: false };
  }
  const now = Date.now();
  const { opensAt, closesAt } = window_(state);
  if (now < opensAt) throw new QuizFailure(409, 'conflict', 'The quiz has not opened yet.', 'window_not_open');
  if (now >= closesAt) throw new QuizFailure(409, 'conflict', 'The quiz has closed.', 'window_closed');
  const source = sourceQuiz(state);
  if (!source) throw new QuizFailure(409, 'conflict', 'The quiz is not ready yet.', 'not_configured');
  const attempt = newAttempt(source, now);
  updateState((draft) => void (draft.quizAttempt = attempt));
  return { state: toState(attempt, closesAt, now), created: true };
}

export const getAttempt = (user: SessionUser): AttemptState =>
  withAttempt(user, (attempt, closesAt, now) => toState(attempt, closesAt, now));

export const nextQuestion = (user: SessionUser): AttemptState =>
  withAttempt(user, (attempt, closesAt, now) => {
    settle(attempt, closesAt, now, 0);
    serve(attempt, closesAt, now);
    return toState(attempt, closesAt, now);
  });

function serve(attempt: MockAttempt, closesAt: number, now: number): void {
  settle(attempt, closesAt, now);
  const item = attempt.items[attempt.cursor];
    if (attempt.status === 'in_progress' && item && item.servedAt === null && now < closesAt) {
      item.servedAt = now;
      item.deadlineAt = Math.min(now + item.timeLimitMs, closesAt);
    }
}

export function putItem(user: SessionUser, index: number, body: unknown): AttemptState {
  const parsed = putAttemptItemSchema.safeParse(body);
  if (!parsed.success) throw new QuizFailure(400, 'validation_failed', 'Check the answer and try again.');
  const { optionId, lock, next, clientElapsedMs } = parsed.data;

  return withAttempt(user, (attempt, closesAt, now) => {
    const lastAction = answer(attempt, now);
    if (lock && next && attempt.cursor > index) serve(attempt, closesAt, now);
    return toState(attempt, closesAt, now, lastAction);
  });

  function answer(attempt: MockAttempt, now: number): AttemptState['lastAction'] {
    const item = attempt.items[index];
    if (!item) throw new QuizFailure(400, 'validation_failed', 'That question does not exist.');
    if (item.servedAt !== null && !item.options.some((option) => option.id === optionId)) {
      throw new QuizFailure(400, 'validation_failed', 'That is not one of the options.');
    }
    if (attempt.status === 'in_progress' && attempt.cursor === index && isLive(item, now)) {
      item.selectedOptionId = optionId;
      if (lock) {
        item.lockedAt = now;
        item.clientElapsedMs = clientElapsedMs ?? null;
        item.outcome = 'locked';
        attempt.cursor += 1;
      }
      return { accepted: true };
    }
    if (item.lockedAt !== null) {
      if (item.selectedOptionId === optionId) return { accepted: true };
      throw new QuizFailure(409, 'conflict', 'That answer is already locked in.', 'already_locked');
    }
    return item.outcome !== null ? { accepted: false, reason: 'time_up' } : { accepted: false };
  }
}

/* ── Control: window.mockApi.setQuizState ───────────────────────────────── */

/** An attempt shaped like each overview state; dates are set by the caller. */
export function attemptFor(kind: MockQuizState, state: MockState): MockAttempt | null {
  const source = sourceQuiz(state);
  if (!source || kind === 'upcoming' || kind === 'open' || kind === 'missed') return null;
  const now = Date.now();
  const attempt = newAttempt(source, now - 120_000);
  const answer = (item: MockItem, at: number) => {
    item.servedAt = at - 8000;
    item.deadlineAt = item.servedAt + item.timeLimitMs;
    item.selectedOptionId = item.options[0]?.id ?? null;
    item.lockedAt = at;
    item.outcome = 'locked';
  };
  if (kind === 'in_progress') {
    // First answered, the next waiting: a resume lands on the between screen.
    answer(attempt.items[0]!, now - 60_000);
    attempt.cursor = 1;
    return attempt;
  }
  attempt.items.forEach((item, i) => answer(item, now - 60_000 + i * 9000));
  attempt.cursor = attempt.items.length;
  attempt.status = kind === 'voided' ? 'voided' : 'completed';
  attempt.completedAt = now - 30_000;
  if (kind === 'voided') attempt.voidReason = 'Answers matched another participant’s exactly.';
  return attempt;
}
