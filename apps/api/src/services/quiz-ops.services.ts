import type { AnyBulkWriteOperation, ClientSession, Types } from 'mongoose';
import { QUIZ_RESCORE_FREEZE_MS } from '@bookquest/shared';
import type {
  AttemptAdmin,
  AttemptRow as AttemptRowDto,
  AttemptStatus,
  Paginated,
  QuizCorrectionPayload,
  QuizCorrectionResult,
  QuizFlag,
  QuizLiveStats
} from '@bookquest/shared';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel, type QuestDocument, type QuestRow } from '../models/quest.model.js';
import { QuizAttemptModel, type AttemptItemRow, type AttemptRow } from '../models/quiz-attempt.model.js';
import { QuizModel, type QuizRow } from '../models/quiz.model.js';
import { ResultModel } from '../models/result.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { groupLabels, resolveGroup } from '../utils/quiz-group.js';
import { escapeRegex } from '../utils/regex.js';
import { withTransaction } from '../utils/transaction.js';
import { participantsById, type ParticipantName } from './participant-lookup.services.js';
import { requireCurrentQuestDocument } from './quest.services.js';
import { resultWrite } from './quiz-attempt.services.js';
import { getQuizAdmin } from './quiz.services.js';
import { isItemCorrect, itemPath, scoreItems } from './quiz-scoring.js';

export interface AttemptListQuery {
  status?: AttemptStatus | undefined;
  flag?: QuizFlag | undefined;
  q?: string | undefined;
  page: number;
  limit: number;
}

type QuizConfig = NonNullable<QuestDocument['quizConfig']>;

const MSG_RESULTS_IMMINENT = 'Results go out in under a minute, so scores are frozen now.';

const iso = (date: Date | null | undefined): string | null => (date ? date.toISOString() : null);

async function quizTitles(ids: Types.ObjectId[]): Promise<Map<string, string>> {
  const quizzes = await QuizModel.find({ _id: { $in: ids } }, { title: 1 }).lean();
  return new Map(quizzes.map((quiz) => [String(quiz._id), quiz.title]));
}

/* ── Live monitor (§5.4) ────────────────────────────────────────────────── */

type GroupBucket = { _id: { group: number; status: string }; n: number; avgScore: number | null; avgDurationMs: number | null };

export async function getLiveStats(): Promise<QuizLiveStats> {
  const quest = await requireCurrentQuestDocument();
  const config = quest.quizConfig;
  if (!config) return { groups: [], updatedAt: new Date().toISOString() };

  const [buckets, roster, titles] = await Promise.all([
    QuizAttemptModel.aggregate<GroupBucket>([
      { $match: { quest: quest._id } },
      {
        $group: {
          _id: { group: '$group', status: '$status' },
          n: { $sum: 1 },
          // Averages are over completed attempts only; the other statuses carry null scores.
          avgScore: { $avg: '$score' },
          avgDurationMs: { $avg: '$durationMs' }
        }
      }
    ]),
    // ≤ 1000 rows per edition, so resolving groups in-process beats a pipeline.
    ParticipantModel.find({ quest: quest._id }, { number: 1 }).lean(),
    quizTitles(config.quizzes)
  ]);

  const labels = groupLabels(config.distribution, config.quizzes.length);
  const assigned = labels.map(() => 0);
  // Spreading the subdocument would copy mongoose internals, not its fields.
  const plain = { distribution: config.distribution, quizzes: config.quizzes, seed: config.seed ?? null };
  for (const participant of roster) assigned[resolveGroup(plain, participant)]! += 1;

  const count = (group: number, status: string) =>
    buckets.find((b) => b._id.group === group && b._id.status === status);

  return {
    groups: labels.map((label, index) => {
      const open = count(index, 'in_progress')?.n ?? 0;
      const done = count(index, 'completed');
      return {
        index,
        label,
        quizTitle: titles.get(String(config.quizzes[index])) ?? 'Unknown quiz',
        assigned: assigned[index]!,
        // Voided attempts are withdrawn, so they no longer count as started.
        started: open + (done?.n ?? 0),
        inProgress: open,
        completed: done?.n ?? 0,
        avgScore: done?.avgScore ?? null,
        avgDurationMs: done?.avgDurationMs ?? null
      };
    }),
    updatedAt: new Date().toISOString()
  };
}

/* ── Attempts ───────────────────────────────────────────────────────────── */

function toRow(
  attempt: Pick<AttemptRow, '_id' | 'group' | 'status' | 'score' | 'total' | 'durationMs' | 'flags' | 'startedAt' | 'completedAt'> & {
    items: Pick<AttemptItemRow, 'outcome'>[];
  },
  participant: ParticipantName | undefined,
  labels: string[]
): AttemptRowDto {
  return {
    id: String(attempt._id),
    participant: participant ?? { number: 0, fullName: 'Unknown' },
    groupLabel: labels[attempt.group] ?? `Group ${attempt.group + 1}`,
    status: attempt.status,
    answered: attempt.items.filter((item) => item.outcome === 'locked' || item.outcome === 'auto').length,
    total: attempt.total ?? attempt.items.length,
    score: attempt.score ?? null,
    durationMs: attempt.durationMs ?? null,
    flags: attempt.flags as QuizFlag[],
    startedAt: attempt.startedAt.toISOString(),
    completedAt: iso(attempt.completedAt)
  };
}

const labelsFor = (config: QuizConfig | null | undefined): string[] =>
  config ? groupLabels(config.distribution, config.quizzes.length) : [];

/** Participants whose name matches, or whose number is exactly `term`. */
async function participantIdsMatching(questId: Types.ObjectId, term: string): Promise<Types.ObjectId[]> {
  const number = Number(term);
  const matches = await ParticipantModel.find(
    {
      quest: questId,
      $or: [
        { fullName: { $regex: escapeRegex(term), $options: 'i' } },
        ...(Number.isInteger(number) ? [{ number }] : [])
      ]
    },
    { _id: 1 }
  ).lean();
  return matches.map((participant) => participant._id);
}

export async function listAttempts(query: AttemptListQuery): Promise<Paginated<AttemptRowDto>> {
  const quest = await requireCurrentQuestDocument();
  const filter: Record<string, unknown> = { quest: quest._id };
  if (query.status) filter.status = query.status;
  if (query.flag) filter.flags = query.flag;

  const term = query.q?.trim();
  if (term) filter.participant = { $in: await participantIdsMatching(quest._id, term) };

  const [attempts, total] = await Promise.all([
    QuizAttemptModel.find(filter, {
      participant: 1, group: 1, status: 1, score: 1, total: 1, durationMs: 1, flags: 1, startedAt: 1, completedAt: 1,
      'items.outcome': 1
    })
      .sort({ startedAt: -1, _id: -1 })
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean<(AttemptRow & { participant: Types.ObjectId })[]>(),
    QuizAttemptModel.countDocuments(filter)
  ]);

  const people = await participantsById(attempts.map((attempt) => attempt.participant));
  const labels = labelsFor(quest.quizConfig);
  return {
    items: attempts.map((attempt) => toRow(attempt, people.get(String(attempt.participant)), labels)),
    page: query.page,
    limit: query.limit,
    total
  };
}

/** The attempt's own quest, which may not be the current one for an old link. */
async function loadAttempt(id: string): Promise<{ attempt: AttemptRow; quest: QuestRow }> {
  const attempt = await QuizAttemptModel.findById(id).lean<AttemptRow>();
  const quest = attempt ? await QuestModel.findById(attempt.quest).lean<QuestRow>() : null;
  if (!attempt || !quest) throw ApiError.notFound('No such attempt.');
  return { attempt, quest };
}

async function rowFor(attempt: AttemptRow, quest: QuestRow): Promise<AttemptRowDto> {
  const people = await participantsById([attempt.participant]);
  return toRow(attempt, people.get(String(attempt.participant)), labelsFor(quest.quizConfig));
}

export async function getAttemptAdmin(id: string): Promise<AttemptAdmin> {
  const { attempt, quest } = await loadAttempt(id);
  const quiz = await QuizModel.findById(attempt.quiz, { title: 1 }).lean();

  return {
    ...(await rowFor(attempt, quest)),
    quizId: String(attempt.quiz),
    quizTitle: quiz?.title ?? 'Deleted quiz',
    quizRevision: attempt.quizRevision,
    finalizedBy: attempt.finalizedBy ?? null,
    clientIdCount: attempt.clientIds.length,
    voidReason: attempt.voidReason ?? null,
    voidedAt: iso(attempt.voidedAt),
    items: attempt.items.map((item, index) => ({
      index,
      questionId: item.questionId,
      type: item.type,
      prompt: item.prompt,
      explanation: item.explanation ?? null,
      options: item.options.map((option) => ({ id: option.id, text: option.text })),
      correctOptionId: item.correctOptionId,
      voided: item.voided,
      difficulty: item.difficulty,
      timeLimitMs: item.timeLimitMs,
      servedAt: iso(item.servedAt),
      deadlineAt: iso(item.deadlineAt),
      selectedOptionId: item.selectedOptionId ?? null,
      selectedAt: iso(item.selectedAt),
      lockedAt: iso(item.lockedAt),
      outcome: item.outcome ?? null,
      isCorrect: item.isCorrect ?? null,
      elapsedMs: item.elapsedMs ?? null,
      signals: { hiddenCount: item.signals?.hiddenCount ?? 0, hiddenMs: item.signals?.hiddenMs ?? 0 }
    }))
  };
}

/** Withdraws an attempt and its Result, before results go out. */
export async function voidAttempt(id: string, reason: string, admin: UserDocument): Promise<AttemptRowDto> {
  const { attempt, quest } = await loadAttempt(id);
  if (Date.now() >= quest.resultsAt.getTime()) {
    throw ApiError.conflict('Results are out, so this attempt can no longer be voided.');
  }
  if (Date.now() >= quest.resultsAt.getTime() - QUIZ_RESCORE_FREEZE_MS) {
    throw ApiError.conflict(MSG_RESULTS_IMMINENT, { reason: 'results_imminent' });
  }

  const voided = await withTransaction(async (session) => {
    // Result first: a crash between the writes (no transaction on standalone Mongo) then leaves a retryable void, never a voided attempt that is still ranked.
    await ResultModel.deleteOne({ quest: attempt.quest, participant: attempt.participant }, { session });

    // Conditional so two admins voiding at once leave one reason, not a race.
    const updated = await QuizAttemptModel.findOneAndUpdate(
      { _id: attempt._id, status: { $ne: 'voided' } },
      { $set: { status: 'voided', voidReason: reason, voidedBy: admin._id, voidedAt: new Date() } },
      { new: true, session }
    ).lean<AttemptRow>();
    if (!updated) throw ApiError.conflict('This attempt was already voided.');

    // Again after the flip: a finalise landing between the first delete and the flip would have rewritten the Result.
    await ResultModel.deleteOne({ quest: attempt.quest, participant: attempt.participant }, { session });
    return updated;
  });

  return rowFor(voided, quest);
}

/* ── Answer-key correction & void question (§5.5, §13.7) ────────────────── */

const RESCORE_BATCH = 200;
// Voided attempts are withdrawn: no Result, nothing to re-score.
const RESCORED_STATUSES = ['in_progress', 'completed'] as const;

/** What every attempt's copy of the question must say once the correction holds. */
type Target = { questionId: string; correctOptionId: string; voided: boolean };

/** Locked (an attempt exists) and no quest using it has published results. */
async function requireCorrectable(quizId: string): Promise<QuizRow> {
  const quiz = await QuizModel.findById(quizId).lean<QuizRow>();
  if (!quiz) throw ApiError.notFound('Quiz not found.');
  const questIds = await QuizAttemptModel.distinct('quest', { quiz: quiz._id });
  if (questIds.length === 0) {
    throw ApiError.conflict('No one has started this quiz yet, so edit it directly instead.');
  }
  if (await QuestModel.exists({ _id: { $in: questIds }, resultsAt: { $lte: new Date() } })) {
    throw ApiError.conflict('Results are out, so the answer key can no longer change.');
  }
  const freezeFrom = new Date(Date.now() + QUIZ_RESCORE_FREEZE_MS);
  if (await QuestModel.exists({ _id: { $in: questIds }, resultsAt: { $lte: freezeFrom } })) {
    throw ApiError.conflict(MSG_RESULTS_IMMINENT, { reason: 'results_imminent' });
  }
  return quiz;
}

function targetOf(quiz: QuizRow, payload: QuizCorrectionPayload): Target {
  const question = quiz.questions.find((q) => q.id === payload.questionId);
  if (!question) throw ApiError.badRequest('That question is not in this quiz.', { questionId: 'Not in this quiz.' });
  const voided = quiz.voidedQuestionIds.includes(question.id);
  const current = { questionId: question.id, correctOptionId: question.correctOptionId ?? '', voided };

  if (payload.kind === 'void') {
    // A quiz where nothing counts would leave every score at 0 / 0.
    if (!voided && quiz.voidedQuestionIds.length + 1 >= quiz.questions.length) {
      throw ApiError.badRequest('At least one question must still count.', { questionId: 'This is the last question that counts.' });
    }
    return { ...current, voided: true };
  }
  if (voided) throw ApiError.conflict('This question is voided, so its answer key no longer counts.');
  if (!question.options.some((option) => option.id === payload.correctOptionId)) {
    throw ApiError.badRequest('That is not one of this question’s options.', { correctOptionId: 'Not an option for this question.' });
  }
  return { ...current, correctOptionId: payload.correctOptionId };
}

/** Writes the quiz side; false when it already says this (a repeat, or a concurrent identical void). */
async function recordCorrection(
  quiz: QuizRow,
  payload: QuizCorrectionPayload,
  target: Target,
  admin: UserDocument,
  session?: ClientSession
): Promise<boolean> {
  const question = quiz.questions.find((q) => q.id === target.questionId)!;
  const from = question.correctOptionId ?? null;
  const note = payload.note || null;
  const entry = { questionId: target.questionId, kind: payload.kind, note, by: admin._id, at: new Date() };
  // $inc revision changes the attempt cache key, so new starts snapshot the corrected quiz.
  const bump = { $inc: { revision: 1 } };

  if (payload.kind === 'void') {
    if (quiz.voidedQuestionIds.includes(target.questionId)) return false;
    const { matchedCount } = await QuizModel.updateOne(
      { _id: quiz._id, 'questions.id': target.questionId, voidedQuestionIds: { $ne: target.questionId } },
      { $addToSet: { voidedQuestionIds: target.questionId }, $push: { corrections: { ...entry, from: null, to: null } }, ...bump },
      { session }
    );
    return matchedCount === 1;
  }

  if (from === target.correctOptionId) return false;
  // Matching the key we read means two admins correcting at once can't log a wrong "from".
  const { matchedCount } = await QuizModel.updateOne(
    {
      _id: quiz._id,
      questions: { $elemMatch: { id: target.questionId, correctOptionId: from } },
      voidedQuestionIds: { $ne: target.questionId }
    },
    {
      $set: { 'questions.$.correctOptionId': target.correctOptionId },
      $push: { corrections: { ...entry, from, to: target.correctOptionId } },
      ...bump
    },
    { session }
  );
  if (matchedCount === 0) {
    throw ApiError.conflict('Someone else just corrected this question. Reload to see their change.', { reason: 'stale' });
  }
  return true;
}

/** Any attempt whose copy of the question disagrees with the target: left by a crash mid-correction. */
async function hasDrift(quizId: Types.ObjectId, target: Target, session?: ClientSession): Promise<boolean> {
  const stale = await QuizAttemptModel.exists({
    quiz: quizId,
    status: { $in: RESCORED_STATUSES },
    items: {
      $elemMatch: {
        questionId: target.questionId,
        $or: [{ correctOptionId: { $ne: target.correctOptionId } }, { voided: { $ne: target.voided } }]
      }
    }
  }).session(session ?? null);
  return stale !== null;
}

async function rescoreBatch(batch: AttemptRow[], target: Target): Promise<void> {
  const results: AnyBulkWriteOperation[] = [];
  const attempts: AnyBulkWriteOperation[] = [];
  const completedIds: Types.ObjectId[] = [];

  for (const attempt of batch) {
    const index = attempt.items.findIndex((item) => item.questionId === target.questionId);
    if (index < 0) continue;
    const item = { ...attempt.items[index]!, correctOptionId: target.correctOptionId, voided: target.voided };
    const $set: Record<string, unknown> = {
      [itemPath(index, 'correctOptionId')]: target.correctOptionId,
      [itemPath(index, 'voided')]: target.voided
    };
    // An unresolved item has no correctness yet; finalise scores it from the new key.
    if (item.outcome != null) $set[itemPath(index, 'isCorrect')] = isItemCorrect(item);

    if (attempt.status === 'completed') {
      const { score, total, durationMs, answered } = scoreItems(attempt.items.map((it, k) => (k === index ? item : it)));
      Object.assign($set, { score, total, durationMs });
      completedIds.push(attempt._id);
      if (answered >= 1) {
        const { filter, update } = resultWrite({ ...attempt, score, total, durationMs, completedAt: attempt.completedAt ?? attempt.updatedAt });
        results.push({ updateOne: { filter, update, upsert: true } });
      }
    }
    // Status as read: one finalised meanwhile misses here and is re-scored by the completed pass.
    attempts.push({ updateOne: { filter: { _id: attempt._id, status: attempt.status }, update: { $set } } });
  }

  // Results first: a crash before the attempt writes leaves drift, which re-running the correction repairs.
  if (results.length > 0) await ResultModel.bulkWrite(results, { ordered: false });
  if (attempts.length > 0) await QuizAttemptModel.bulkWrite(attempts, { ordered: false });

  // Voided meanwhile: the upsert must not resurrect its Result.
  if (completedIds.length > 0) {
    const voided = await QuizAttemptModel.find({ _id: { $in: completedIds }, status: 'voided' }, { quest: 1, participant: 1 })
      .lean<Pick<AttemptRow, 'quest' | 'participant'>[]>();
    if (voided.length > 0) {
      await ResultModel.deleteMany({ $or: voided.map(({ quest, participant }) => ({ quest, participant })) });
    }
  }
}

// Covers a finalise whose read began just before the correction started.
const FINALIZE_SLACK_MS = 5_000;

async function rescoreWhere(filter: Record<string, unknown>, target: Target, touched: Set<string>): Promise<void> {
  const cursor = QuizAttemptModel.find(filter).lean<AttemptRow[]>().cursor({ batchSize: RESCORE_BATCH });
  let batch: AttemptRow[] = [];
  for await (const attempt of cursor as AsyncIterable<AttemptRow>) {
    batch.push(attempt);
    touched.add(String(attempt._id));
    if (batch.length === RESCORE_BATCH) {
      await rescoreBatch(batch, target);
      batch = [];
    }
  }
  if (batch.length > 0) await rescoreBatch(batch, target);
}

/** In-progress first, so one that finalises mid-run is picked up by the completed pass. */
async function rescoreAttempts(quizId: Types.ObjectId, target: Target, since: Date): Promise<number> {
  const touched = new Set<string>();
  for (const status of RESCORED_STATUSES) await rescoreWhere({ quiz: quizId, status }, target, touched);
  // A finalise that scored from the old key can land after the completed pass passed it; it completed after `since`.
  await rescoreWhere({ quiz: quizId, status: 'completed', completedAt: { $gte: since } }, target, touched);
  return touched.size;
}

/** Changes a question's key or voids it, then re-scores every attempt on the quiz from its stored answers. */
export async function applyCorrection(
  quizId: string,
  payload: QuizCorrectionPayload,
  admin: UserDocument
): Promise<QuizCorrectionResult> {
  const quiz = await requireCorrectable(quizId);
  const target = targetOf(quiz, payload);
  const since = new Date(Date.now() - FINALIZE_SLACK_MS);

  // Quiz first: a crash after it is repaired by re-running the same correction (drift check).
  const needsRescore = await withTransaction(async (session) => {
    const changed = await recordCorrection(quiz, payload, target, admin, session);
    return changed || (await hasDrift(quiz._id, target, session));
  });
  // Outside the transaction: one spanning every attempt would abort on any live lock and block participant writes.
  const rescored = needsRescore ? await rescoreAttempts(quiz._id, target, since) : 0;

  return { quiz: await getQuizAdmin(quizId), rescored };
}
