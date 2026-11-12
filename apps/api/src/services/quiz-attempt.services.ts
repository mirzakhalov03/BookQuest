import { Types, type ClientSession, type UpdateQuery } from 'mongoose';
import {
  QUIZ_ANSWER_GRACE_MS,
  TRUE_FALSE_OPTION_IDS,
  effectiveTimeLimitSec,
  type AttemptQuestion,
  type AttemptReview,
  type AttemptState,
  type Participant,
  type PutAttemptItemPayload,
  type QuizOverview,
  type QuizContent,
  type QuizOption,
  type QuizOverviewState,
  type QuizQuestion
} from '@bookquest/shared';
import { quizDrillCrashAfterFinalize } from '../config/env.js';
import { logger } from '../config/logger.js';
import type { QuestDocument, QuestRow } from '../models/quest.model.js';
import { QuizAttemptModel, type AttemptItemRow, type AttemptRow } from '../models/quiz-attempt.model.js';
import { ResultModel } from '../models/result.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { resolveGroup } from '../utils/quiz-group.js';
import { shuffle } from '../utils/random.js';
import { withTransaction } from '../utils/transaction.js';
import { findParticipantForUser } from './participant.services.js';
import { findCurrentQuestDocument } from './quest.services.js';
import { loadQuizForAttempt } from './quiz.services.js';
import { alertCappedClaims } from './quiz-alerts.services.js';
import {
  IS_DATE,
  IS_NULL,
  computeFlags,
  isItemCorrect,
  itemPath,
  lockedElapsed,
  resolveExpired,
  scoreItems,
  settleServed
} from './quiz-scoring.js';

type QuizWindow = Pick<QuestRow, 'quizClosesAt' | 'resultsAt'>;
type FinalizedBy = 'participant' | 'sweep' | 'ranking';
type LastAction = NonNullable<AttemptState['lastAction']>;

const G = QUIZ_ANSWER_GRACE_MS;
const MAX_CLIENT_IDS = 10;
// settle + close-out + finalise, plus slack for writes lost to a concurrent tab.
const MAX_SETTLE_PASSES = 6;
const TRUE_FALSE_TEXT: Record<(typeof TRUE_FALSE_OPTION_IDS)[number], string> = { true: 'True', false: 'False' };

const MSG = {
  noQuest: 'No quiz is scheduled right now.',
  notRegistered: 'You have not registered for this quest yet.',
  notStarted: 'You have not started the quiz yet.',
  notOpen: 'The quiz has not opened yet.',
  closed: 'The quiz has closed.',
  notConfigured: 'The quiz is not ready yet.',
  completed: 'You have already completed the quiz.',
  voided: 'Your attempt was withdrawn by the organisers.',
  locked: 'That answer is already locked in.',
  reviewLocked: 'Answers are shown once results are announced.',
  reviewUnavailable: 'There is no completed attempt to review.'
} as const;

/* ── Loading ────────────────────────────────────────────────────────────── */

type ParticipantContext = { quest: QuestDocument; participant: Participant; now: Date };
type AttemptContext = ParticipantContext & { attempt: AttemptRow };

async function requireQuest(): Promise<QuestDocument> {
  const quest = await findCurrentQuestDocument();
  if (!quest) throw ApiError.notFound(MSG.noQuest, { reason: 'not_configured' });
  return quest;
}

async function requireParticipantContext(user: UserDocument): Promise<ParticipantContext> {
  const now = new Date();
  const quest = await requireQuest();
  const participant = await findParticipantForUser(user, quest);
  if (!participant) throw ApiError.notFound(MSG.notRegistered, { reason: 'not_registered' });
  return { quest, participant, now };
}

function findAttempt(questId: Types.ObjectId, participantId: string): Promise<AttemptRow | null> {
  return QuizAttemptModel.findOne({ quest: questId, participant: participantId }).lean<AttemptRow>();
}

/** Every play request starts here, so the attempt is read by user, in parallel with the participant. */
async function requireAttemptContext(user: UserDocument, now = new Date()): Promise<AttemptContext> {
  const quest = await requireQuest();
  const [participant, attempt] = await Promise.all([
    findParticipantForUser(user, quest),
    QuizAttemptModel.findOne({ quest: quest._id, user: user._id }).lean<AttemptRow>()
  ]);
  if (!participant) throw ApiError.notFound(MSG.notRegistered, { reason: 'not_registered' });
  if (!attempt || String(attempt.participant) !== participant.id) throw ApiError.notFound(MSG.notStarted, { reason: 'not_started' });
  return { quest, participant, now, attempt };
}

async function reload(attempt: AttemptRow): Promise<AttemptRow> {
  const fresh = await QuizAttemptModel.findById(attempt._id).lean<AttemptRow>();
  if (!fresh) throw ApiError.notFound(MSG.notStarted, { reason: 'not_started' });
  return fresh;
}

const itemAt = (attempt: AttemptRow, index: number): AttemptItemRow | undefined => attempt.items[index];

/* ── Settle (§10.2) ─────────────────────────────────────────────────────── */

function settleItem(
  attempt: AttemptRow,
  index: number,
  settled: { outcome: string; isCorrect: boolean; elapsedMs: number }
): Promise<unknown> {
  return QuizAttemptModel.updateOne(
    {
      _id: attempt._id,
      status: 'in_progress',
      cursor: index,
      [itemPath(index, 'lockedAt')]: IS_NULL,
      [itemPath(index, 'outcome')]: IS_NULL,
      // Pinned to the selection the outcome was computed from: an in-grace tap landing meanwhile forces a recompute.
      [itemPath(index, 'selectedOptionId')]: attempt.items[index]?.selectedOptionId ?? IS_NULL
    },
    {
      $set: {
        [itemPath(index, 'outcome')]: settled.outcome,
        [itemPath(index, 'isCorrect')]: settled.isCorrect,
        [itemPath(index, 'elapsedMs')]: settled.elapsedMs
      },
      $inc: { cursor: 1 }
    }
  );
}

/** Window over: every item from the cursor on was never served, so it is charged in full. */
function closeOut(attempt: AttemptRow): Promise<unknown> {
  const $set: Record<string, unknown> = { cursor: attempt.items.length };
  for (let k = attempt.cursor; k < attempt.items.length; k++) {
    $set[itemPath(k, 'outcome')] = 'unserved';
    $set[itemPath(k, 'isCorrect')] = false;
    $set[itemPath(k, 'elapsedMs')] = attempt.items[k]!.timeLimitMs;
  }
  const filter: Record<string, unknown> = { _id: attempt._id, status: 'in_progress', cursor: attempt.cursor };
  // An item served a moment ago must not be overwritten as unserved; a miss reloads and settles it instead.
  if (attempt.cursor < attempt.items.length) filter[itemPath(attempt.cursor, 'servedAt')] = IS_NULL;
  return QuizAttemptModel.updateOne(filter, { $set });
}

/** The next conditional write settle owes this attempt, or null when it is settled. */
function nextSettleStep(
  attempt: AttemptRow,
  quest: QuizWindow,
  now: Date,
  by: FinalizedBy,
  graceMs: number
): (() => Promise<unknown>) | null {
  const index = attempt.cursor;
  const item = itemAt(attempt, index);
  if (!item) return () => finalizeAttempt(attempt._id, by);

  const closed = now.getTime() >= quest.quizClosesAt.getTime() + G;
  const settled = closed ? settleServed(item) : resolveExpired(item, now, graceMs);
  if (settled) return () => settleItem(attempt, index, settled);
  if (closed) return () => closeOut(attempt);
  return null;
}

/** Brings stored state up to `now`; every write is conditional, so concurrent settlers are harmless. */
export async function settleAttempt(
  attempt: AttemptRow,
  quest: QuizWindow,
  now: Date,
  by: FinalizedBy = 'participant',
  graceMs = G
): Promise<AttemptRow> {
  let current = attempt;
  for (let pass = 0; pass < MAX_SETTLE_PASSES && current.status === 'in_progress'; pass++) {
    const step = nextSettleStep(current, quest, now, by, graceMs);
    if (!step) break;
    await step();
    current = await reload(current);
  }
  return current;
}

/* ── Finalise (§13.4) ───────────────────────────────────────────────────── */

export type FinalizedAttempt = Pick<AttemptRow, '_id' | 'quest' | 'participant'> & {
  score: number;
  total: number;
  durationMs: number;
  completedAt: Date;
};

/** The one shape of a Result write, so finalise, repair and re-scoring store identical rows. */
export function resultWrite(attempt: FinalizedAttempt) {
  const { score, total, durationMs, completedAt } = attempt;
  return {
    filter: { quest: attempt.quest, participant: attempt.participant },
    update: { $set: { score, total, durationMs, submittedAt: completedAt } }
  };
}

/** Steps 2–3 of finalise, shared with repair: idempotent upsert, then the repair marker. */
async function writeResult(attempt: FinalizedAttempt, answered: number, session?: ClientSession): Promise<void> {
  // Tapping Start and answering nothing earns no Result (and so no rank or certificate).
  if (answered >= 1) {
    const { filter, update } = resultWrite(attempt);
    await ResultModel.updateOne(filter, update, { upsert: true, session });
  }
  // Set even without a Result, so the repair sweep skips this attempt.
  await QuizAttemptModel.updateOne({ _id: attempt._id }, { $set: { resultWrittenAt: new Date() } }, { session });
}

export async function finalizeAttempt(attemptId: Types.ObjectId, by: FinalizedBy): Promise<void> {
  const outcome = await withTransaction(async (session) => {
    const attempt = await QuizAttemptModel.findById(attemptId)
      .session(session ?? null)
      .lean<AttemptRow>();
    if (!attempt || attempt.status !== 'in_progress' || attempt.cursor !== attempt.items.length) return null;

    const now = new Date();
    const { score, total, durationMs, answered } = scoreItems(attempt.items);
    // Stored per-item isCorrect can predate a correction that raced a lock; rewrite it from the same read as score.
    const itemCorrect: Record<string, boolean> = {};
    attempt.items.forEach((item, k) => {
      if (item.outcome != null) itemCorrect[itemPath(k, 'isCorrect')] = isItemCorrect(item);
    });
    const done = await QuizAttemptModel.findOneAndUpdate(
      { _id: attemptId, status: 'in_progress', cursor: attempt.items.length },
      {
        $set: {
          ...itemCorrect,
          status: 'completed',
          completedAt: now,
          score,
          total,
          durationMs,
          flags: computeFlags(attempt),
          finalizedBy: by
        }
      },
      { session }
    ).lean<AttemptRow>();
    // Someone else finalised it.
    if (!done) return null;

    if (quizDrillCrashAfterFinalize) {
      logger.fatal({ attemptId: String(attemptId) }, 'QUIZ_DRILL_CRASH_AFTER_FINALIZE: exiting before the Result write');
      process.exit(1);
    }

    await writeResult({ ...done, score, total, durationMs, completedAt: now }, answered, session);
    return { score, total, attempt: done };
  });

  if (!outcome) return;
  logger.info({ attemptId: String(attemptId), finalizedBy: by, score: outcome.score, total: outcome.total }, 'quiz attempt finalised');
  // After the commit and off the request path: a slow Telegram never delays the participant's "Done".
  void alertCappedClaims(outcome.attempt);
}

/* ── Sweep, ranking guard & repair (§13.5) ──────────────────────────────── */

const SWEEP_BATCH = 50;

/** Settles and finalises every open attempt once the window plus grace is over; returns how many completed. */
export async function finalizeOpenAttempts(
  quest: QuestDocument,
  now = new Date(),
  by: 'sweep' | 'ranking' = 'sweep'
): Promise<number> {
  if (now.getTime() < quest.quizClosesAt.getTime() + G) return 0;

  let finalized = 0;
  let failed = 0;
  let unsettled = 0;
  const open = QuizAttemptModel.find({ quest: quest._id, status: 'in_progress' })
    .lean<AttemptRow[]>()
    .cursor({ batchSize: SWEEP_BATCH });
  for await (const attempt of open as AsyncIterable<AttemptRow>) {
    try {
      const settled = await settleAttempt(attempt, quest, now, by);
      if (settled.status === 'completed') finalized += 1;
      else if (settled.status === 'in_progress') {
        // Settle ran out of passes: still open, so neither finalised nor safe to rank around.
        unsettled += 1;
        logger.warn({ attemptId: String(attempt._id), cursor: settled.cursor, by }, 'quiz attempt still open after settle');
      }
    } catch (error) {
      // One bad attempt must not stall the rest of the sweep.
      failed += 1;
      logger.error({ err: error, attemptId: String(attempt._id), by }, 'quiz attempt could not be finalised');
    }
  }
  // Ranking an incomplete field would freeze wrong ranks; fail so the next read retries.
  if (failed + unsettled > 0 && by === 'ranking') {
    throw new Error(`${failed + unsettled} quiz attempt(s) could not be finalised before ranking`);
  }
  return finalized;
}

/** Completed attempts whose Result write never landed (crash, or a standalone dev DB). */
export async function repairMissingResults(quest: QuestDocument): Promise<number> {
  let repaired = 0;
  const pending = QuizAttemptModel.find({ quest: quest._id, status: 'completed', resultWrittenAt: null })
    .lean<AttemptRow[]>()
    .cursor({ batchSize: SWEEP_BATCH });
  for await (const attempt of pending as AsyncIterable<AttemptRow>) {
    await writeResult(
      {
        ...attempt,
        score: attempt.score ?? 0,
        total: attempt.total ?? 0,
        durationMs: attempt.durationMs ?? 0,
        completedAt: attempt.completedAt ?? attempt.updatedAt
      },
      scoreItems(attempt.items).answered
    );
    repaired += 1;
  }
  return repaired;
}

/** The 60 s timer and the boot pass: current quest only. */
export async function runQuizSweep(now = new Date()): Promise<void> {
  const quest = await findCurrentQuestDocument();
  if (!quest) return;
  const finalized = await finalizeOpenAttempts(quest, now, 'sweep');
  const repaired = await repairMissingResults(quest);
  if (finalized > 0 || repaired > 0) logger.info({ edition: quest.edition, finalized, repaired }, 'quiz sweep');
}

/* ── Mapping (never spreads an item: answers must not leak) ─────────────── */

function isLive(item: AttemptItemRow | undefined, now: Date): item is AttemptItemRow {
  return (
    item != null &&
    item.servedAt != null &&
    item.lockedAt == null &&
    item.outcome == null &&
    now.getTime() <= item.deadlineAt!.getTime() + G
  );
}

function toQuestion(item: AttemptItemRow, index: number): AttemptQuestion {
  return {
    index,
    type: item.type,
    prompt: item.prompt,
    options: item.options.map((option) => ({ id: option.id, text: option.text })),
    timeLimitMs: item.timeLimitMs,
    servedAt: item.servedAt!.toISOString(),
    deadlineAt: item.deadlineAt!.toISOString(),
    selectedOptionId: item.selectedOptionId ?? null
  };
}

function attemptPhase(attempt: AttemptRow, live: boolean): AttemptState['phase'] {
  if (attempt.status === 'voided') return 'voided';
  if (attempt.status === 'completed') return 'completed';
  if (live) return 'question';
  if (attempt.cursor === 0 && itemAt(attempt, 0)?.servedAt == null) return 'ready';
  return 'between';
}

export function toAttemptState(
  attempt: AttemptRow,
  quest: QuizWindow,
  now: Date,
  lastAction?: LastAction
): AttemptState {
  const item = itemAt(attempt, attempt.cursor);
  const live = attempt.status === 'in_progress' && isLive(item, now);
  // Scores stay sealed until results day, so nobody compares or reverse-engineers answers meanwhile.
  const published = now >= quest.resultsAt;
  return {
    attemptId: String(attempt._id),
    status: attempt.status,
    phase: attemptPhase(attempt, live),
    position: { index: attempt.cursor, total: attempt.items.length },
    question: live ? toQuestion(item!, attempt.cursor) : null,
    ...(lastAction ? { lastAction } : {}),
    result:
      attempt.status === 'completed' && published
        ? { score: attempt.score ?? 0, total: attempt.total ?? 0, durationMs: attempt.durationMs ?? 0 }
        : null,
    windowClosesAt: quest.quizClosesAt.toISOString(),
    serverNow: now.toISOString()
  };
}

/* ── Overview (§4.1) ────────────────────────────────────────────────────── */

function overviewState(quest: QuestDocument, attempt: AttemptRow | null, now: Date): QuizOverviewState {
  if (attempt?.status === 'voided') return 'voided';
  if (now >= quest.resultsAt) return 'results';
  // Completed with nothing answered has no Result: shown as missed.
  if (attempt?.status === 'completed') return scoreItems(attempt.items).answered > 0 ? 'completed' : 'missed';
  if (attempt) return 'in_progress';
  if (!quest.quizConfig) return 'not_configured';
  if (now < quest.quizOpensAt) return 'upcoming';
  if (now < quest.quizClosesAt) return 'open';
  return 'missed';
}

/** Which variant (group index into `quizConfig.quizzes`) this participant sits. */
function groupOf(config: NonNullable<QuestDocument['quizConfig']>, participant: Participant): number {
  return resolveGroup(
    { distribution: config.distribution, quizzes: config.quizzes, seed: config.seed ?? null },
    { _id: new Types.ObjectId(participant.id), number: participant.number }
  );
}

/** The participant's own variant: the attempt's frozen quiz once started, else their group's. */
async function overviewQuiz(
  quest: QuestDocument,
  participant: Participant,
  attempt: AttemptRow | null
): Promise<QuizOverview['quiz']> {
  const config = quest.quizConfig;
  if (!attempt && !config) return null;

  const quizId = attempt?.quiz ?? config!.quizzes[groupOf(config!, participant)]!;
  const { quiz, shape: quizWide } = await loadQuizForAttempt(String(quizId));
  const shape = attempt
    ? {
        questionCount: attempt.items.length,
        totalSeconds: Math.round(attempt.items.reduce((sum, item) => sum + item.timeLimitMs, 0) / 1000)
      }
    : quizWide;
  return {
    title: quiz.title,
    description: quiz.description ?? null,
    questionCount: shape.questionCount,
    totalSeconds: shape.totalSeconds
  };
}

// With the results, not at close: the key would otherwise give away every score early.
const reviewOpen = (attempt: AttemptRow, quest: QuizWindow, now: Date): boolean =>
  attempt.status === 'completed' && now >= quest.resultsAt;

function toOverviewAttempt(attempt: AttemptRow, quest: QuizWindow, now: Date): NonNullable<QuizOverview['attempt']> {
  // Sealed until results day, as in `toAttemptState`.
  const completed = attempt.status === 'completed' && now >= quest.resultsAt;
  return {
    status: attempt.status,
    answered: scoreItems(attempt.items).answered,
    total: attempt.total ?? attempt.items.length,
    score: completed ? (attempt.score ?? 0) : null,
    durationMs: completed ? (attempt.durationMs ?? 0) : null,
    voidReason: attempt.voidReason ?? null,
    reviewAvailable: reviewOpen(attempt, quest, now)
  };
}

export async function getOverview(user: UserDocument, now = new Date()): Promise<QuizOverview> {
  const serverNow = now.toISOString();
  const quest = await findCurrentQuestDocument();
  if (!quest) return { state: 'no_quest', serverNow, window: null, quiz: null, attempt: null };

  const window = {
    opensAt: quest.quizOpensAt.toISOString(),
    closesAt: quest.quizClosesAt.toISOString(),
    resultsAt: quest.resultsAt.toISOString()
  };
  const participant = await findParticipantForUser(user, quest);
  if (!participant) return { state: 'not_registered', serverNow, window, quiz: null, attempt: null };

  let attempt = await findAttempt(quest._id, participant.id);
  if (attempt?.status === 'in_progress') attempt = await settleAttempt(attempt, quest, now);

  return {
    state: overviewState(quest, attempt, now),
    serverNow,
    window,
    quiz: await overviewQuiz(quest, participant, attempt),
    attempt: attempt ? toOverviewAttempt(attempt, quest, now) : null
  };
}

/* ── Review (§8.1) ──────────────────────────────────────────────────────── */

/** The only participant path that serialises the answer key: gated on results and a completed attempt. */
export async function getReview(user: UserDocument, now = new Date()): Promise<AttemptReview> {
  const { quest, attempt } = await requireAttemptContext(user);
  if (now < quest.resultsAt) throw ApiError.notFound(MSG.reviewLocked, { reason: 'results_not_published' });
  if (attempt.status !== 'completed') throw ApiError.notFound(MSG.reviewUnavailable, { reason: 'review_unavailable' });
  return {
    items: attempt.items.map((item, index) => ({
      index,
      prompt: item.prompt,
      options: item.options.map(({ id, text }) => ({ id, text })),
      selectedOptionId: item.selectedOptionId ?? null,
      correctOptionId: item.correctOptionId,
      outcome: item.outcome ?? null,
      isCorrect: item.isCorrect ?? null,
      voided: item.voided,
      elapsedMs: item.elapsedMs ?? null,
      explanation: item.explanation ?? null
    })),
    score: attempt.score ?? 0,
    total: attempt.total ?? 0,
    durationMs: attempt.durationMs ?? 0
  };
}

/* ── Start ──────────────────────────────────────────────────────────────── */

function snapshotOptions(question: QuizQuestion, shuffleOptions: boolean): QuizOption[] {
  if (question.type === 'true_false') return TRUE_FALSE_OPTION_IDS.map((id) => ({ id, text: TRUE_FALSE_TEXT[id] }));
  return shuffleOptions ? shuffle(question.options) : question.options;
}

/** Reads the shared cached content: items may alias its option arrays, so nothing downstream may mutate them. */
function buildItems({ settings, questions }: QuizContent, voidedQuestionIds: readonly string[]) {
  return (settings.shuffleQuestions ? shuffle(questions) : questions).map((question) => ({
    questionId: question.id,
    type: question.type,
    prompt: question.prompt,
    explanation: question.explanation,
    options: snapshotOptions(question, settings.shuffleOptions),
    correctOptionId: question.correctOptionId,
    voided: voidedQuestionIds.includes(question.id),
    difficulty: question.difficulty,
    timeLimitMs: effectiveTimeLimitSec(question, settings) * 1000,
    // Explicit nulls: positional `$type: 'null'` filters (IS_NULL) only match a real stored null.
    servedAt: null,
    deadlineAt: null,
    selectedOptionId: null,
    selectedAt: null,
    lockedAt: null,
    outcome: null,
    isCorrect: null,
    elapsedMs: null,
    clientElapsedMs: null,
    signals: { hiddenCount: 0, hiddenMs: 0 }
  }));
}

type AttemptStart = Pick<AttemptRow, 'quest' | 'participant' | 'user' | 'quiz' | 'quizRevision' | 'group' | 'startedAt'> & {
  items: ReturnType<typeof buildItems>;
};

/* Every schema field, in schema order with its default, so a raw insert stores
   exactly what `create()` would (checked byte for byte), without hydrating ~20
   subdocuments per start: most of the start burst's CPU (§15). Items derive from
   a quiz the schema and `findQuizIssues` already validated. */
function attemptDocument(start: AttemptStart, now: Date): AttemptRow {
  return {
    quest: start.quest,
    participant: start.participant,
    user: start.user,
    quiz: start.quiz,
    quizRevision: start.quizRevision,
    group: start.group,
    status: 'in_progress',
    cursor: 0,
    items: start.items,
    startedAt: start.startedAt,
    completedAt: null,
    finalizedBy: null,
    score: null,
    total: null,
    durationMs: null,
    resultWrittenAt: null,
    clientIds: [],
    flags: [],
    voidReason: null,
    voidedBy: null,
    voidedAt: null,
    _id: new Types.ObjectId(),
    createdAt: now,
    updatedAt: now,
    __v: 0
  } as unknown as AttemptRow;
}

async function stateOfExisting(existing: AttemptRow, quest: QuestDocument, now: Date): Promise<AttemptState> {
  if (existing.status === 'completed') throw ApiError.conflict(MSG.completed, { reason: 'already_completed' });
  if (existing.status === 'voided') throw ApiError.conflict(MSG.voided, { reason: 'voided' });
  return toAttemptState(await settleAttempt(existing, quest, now), quest, now);
}

export async function startAttempt(user: UserDocument): Promise<{ state: AttemptState; created: boolean }> {
  const { quest, participant, now } = await requireParticipantContext(user);
  if (now < quest.quizOpensAt) throw ApiError.conflict(MSG.notOpen, { reason: 'window_not_open' });
  if (now >= quest.quizClosesAt) throw ApiError.conflict(MSG.closed, { reason: 'window_closed' });
  const config = quest.quizConfig;
  if (!config) throw ApiError.conflict(MSG.notConfigured, { reason: 'not_configured' });

  const existing = await findAttempt(quest._id, participant.id);
  if (existing) return { state: await stateOfExisting(existing, quest, now), created: false };

  const group = groupOf(config, participant);
  const { quiz, content, valid } = await loadQuizForAttempt(String(config.quizzes[group]));
  // Config validation keeps attached quizzes complete; this guards the invariant, not a user path.
  if (!valid) throw ApiError.conflict(MSG.notConfigured, { reason: 'not_configured' });

  try {
    const created = attemptDocument(
      {
        quest: quest._id,
        participant: new Types.ObjectId(participant.id),
        user: user._id,
        quiz: quiz._id,
        quizRevision: quiz.revision,
        group,
        startedAt: now,
        items: buildItems(content, quiz.voidedQuestionIds)
      },
      now
    );
    await QuizAttemptModel.collection.insertOne(created);
    return { state: toAttemptState(created, quest, now), created: true };
  } catch (error) {
    // Two taps or two tabs: the unique index picked a winner; return theirs.
    if (!isDuplicateKeyError(error)) throw error;
    const winner = await findAttempt(quest._id, participant.id);
    if (!winner) throw error;
    return { state: toAttemptState(await settleAttempt(winner, quest, now), quest, now), created: false };
  }
}

/* ── Play ───────────────────────────────────────────────────────────────── */

export async function getAttemptState(user: UserDocument): Promise<AttemptState> {
  const { quest, attempt, now } = await requireAttemptContext(user);
  return toAttemptState(await settleAttempt(attempt, quest, now), quest, now);
}

/**
 * The client calls this only after its own saves have landed, so an expired question is settled at
 * its deadline rather than after the grace: moving on never waits out a grace the client doesn't need.
 */
export async function serveNext(user: UserDocument, receivedAt?: Date): Promise<AttemptState> {
  const { quest, attempt: loaded, now } = await requireAttemptContext(user, receivedAt);
  const attempt = await settleAttempt(loaded, quest, now, 'participant', 0);
  return toAttemptState(await serveFrom(attempt, quest, now), quest, now);
}

/** Serves `items[cursor]` if it hasn't been yet; a live item is returned unchanged, with its original deadline. */
async function serveFrom(settled: AttemptRow, quest: QuestDocument, now: Date): Promise<AttemptRow> {
  let attempt = settled;
  const index = attempt.cursor;
  const item = itemAt(attempt, index);
  if (attempt.status === 'in_progress' && item && item.servedAt == null) {
    // Stamped as late as possible: the clock starts at this write, not when the request came in,
    // so server work before it (reads, the lock this request may carry) is never charged to the participant.
    const servedAt = new Date();
    if (servedAt >= quest.quizClosesAt) {
      // Nothing can be served any more, so there is nothing left to wait for.
      await closeOut(attempt);
    } else {
      const served = await QuizAttemptModel.findOneAndUpdate(
        { _id: attempt._id, status: 'in_progress', cursor: index, [itemPath(index, 'servedAt')]: IS_NULL },
        {
          $set: {
            [itemPath(index, 'servedAt')]: servedAt,
            [itemPath(index, 'deadlineAt')]: new Date(
              Math.min(servedAt.getTime() + item.timeLimitMs, quest.quizClosesAt.getTime())
            )
          }
        },
        { new: true }
      ).lean<AttemptRow>();
      // Fresh from the write, so nothing to settle: skip a round trip the participant's clock would pay for.
      if (served) return served;
    }
    // Not matched (another tab served it) or closed out: the reloaded state is the answer.
    attempt = await settleAttempt(await reload(attempt), quest, now);
  }
  return attempt;
}

function answerUpdate(
  attempt: AttemptRow,
  item: AttemptItemRow,
  index: number,
  body: PutAttemptItemPayload,
  now: Date
): UpdateQuery<AttemptRow> {
  const $set: Record<string, unknown> = {
    [itemPath(index, 'selectedOptionId')]: body.optionId,
    [itemPath(index, 'selectedAt')]: now
  };
  const update: Record<string, unknown> = { $set };
  if (body.lock) {
    $set[itemPath(index, 'lockedAt')] = now;
    $set[itemPath(index, 'outcome')] = 'locked';
    $set[itemPath(index, 'isCorrect')] = isItemCorrect({ ...item, selectedOptionId: body.optionId, outcome: 'locked' });
    const clientElapsedMs = body.clientElapsedMs ?? null;
    $set[itemPath(index, 'clientElapsedMs')] = clientElapsedMs;
    $set[itemPath(index, 'elapsedMs')] = lockedElapsed({ ...item, clientElapsedMs }, now);
    update.$inc = { cursor: 1 };
  }
  if (body.signals) {
    update.$max = {
      [`${itemPath(index, 'signals')}.hiddenCount`]: body.signals.hiddenCount,
      [`${itemPath(index, 'signals')}.hiddenMs`]: body.signals.hiddenMs
    };
  }
  if (attempt.clientIds.length < MAX_CLIENT_IDS) update.$addToSet = { clientIds: body.clientId };
  return update;
}

/** Why an answer did not land, decided from freshly reloaded and settled state. */
function rejectedAction(attempt: AttemptRow, index: number, body: PutAttemptItemPayload): LastAction {
  const item = attempt.items[index]!;
  if (item.lockedAt != null) {
    // A replay of the same answer is success; a different one lost to the first lock.
    if (item.selectedOptionId === body.optionId) return { accepted: true };
    throw ApiError.conflict(MSG.locked, { reason: 'already_locked' });
  }
  if (item.outcome != null) return { accepted: false, reason: 'time_up' };
  return { accepted: false };
}

/** `receivedAt` (arrival, before auth) is the answer's time: lock elapsed and the grace check use it. */
export async function putItem(
  user: UserDocument,
  index: number,
  body: PutAttemptItemPayload,
  receivedAt?: Date
): Promise<AttemptState> {
  const { quest, attempt: loaded, now } = await requireAttemptContext(user, receivedAt);
  if (index >= loaded.items.length) {
    throw ApiError.badRequest('That question does not exist.', { index: 'Out of range.' });
  }
  let attempt = await settleAttempt(loaded, quest, now);
  const item = attempt.items[index]!;
  // Only served items are checked, so probing an unserved index reveals nothing about it.
  if (item.servedAt != null && !item.options.some((option) => option.id === body.optionId)) {
    throw ApiError.badRequest('That is not one of the options.', { optionId: 'Not an option for this question.' });
  }

  let lastAction: LastAction | null = null;
  if (attempt.status === 'in_progress' && attempt.cursor === index && isLive(item, now)) {
    // Returns the written document, saving the reload round trip on the hot path.
    const written = await QuizAttemptModel.findOneAndUpdate(
      {
        _id: attempt._id,
        status: 'in_progress',
        cursor: index,
        [itemPath(index, 'lockedAt')]: IS_NULL,
        [itemPath(index, 'servedAt')]: IS_DATE,
        [itemPath(index, 'deadlineAt')]: { $gte: new Date(now.getTime() - G) }
      },
      answerUpdate(attempt, item, index, body, now),
      { new: true }
    ).lean<AttemptRow>();
    attempt = await settleAttempt(written ?? (await reload(attempt)), quest, now);
    if (written) lastAction = { accepted: true };
  }
  lastAction ??= rejectedAction(attempt, index, body);
  // "Continue": the question is behind us (locked, or timed out meanwhile), so serve the next one now.
  if (body.lock && body.next && attempt.cursor > index) attempt = await serveFrom(attempt, quest, now);
  return toAttemptState(attempt, quest, now, lastAction);
}
