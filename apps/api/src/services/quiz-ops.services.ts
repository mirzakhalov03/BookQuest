import type { Types } from 'mongoose';
import type {
  AttemptAdmin,
  AttemptRow as AttemptRowDto,
  AttemptStatus,
  Paginated,
  QuizFlag,
  QuizLiveStats
} from '@bookquest/shared';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel, type QuestDocument, type QuestRow } from '../models/quest.model.js';
import { QuizAttemptModel, type AttemptItemRow, type AttemptRow } from '../models/quiz-attempt.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { ResultModel } from '../models/result.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { groupLabels, resolveGroup } from '../utils/quiz-group.js';
import { escapeRegex } from '../utils/regex.js';
import { withTransaction } from '../utils/transaction.js';
import { participantsById, type ParticipantName } from './participant-lookup.services.js';
import { requireCurrentQuestDocument } from './quest.services.js';

export interface AttemptListQuery {
  status?: AttemptStatus | undefined;
  flag?: QuizFlag | undefined;
  q?: string | undefined;
  page: number;
  limit: number;
}

type QuizConfig = NonNullable<QuestDocument['quizConfig']>;

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

    return updated;
  });

  return rowFor(voided, quest);
}
