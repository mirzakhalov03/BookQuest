import type { Types } from 'mongoose';
import {
  QUIZ_TEXT_LIMITS,
  findQuizIssues,
  quizShape,
  type CreateQuizPayload,
  type QuizContent,
  type QuizShape,
  type QuizAdmin,
  type QuizSummaryAdmin,
  type SaveQuizPayload
} from '@bookquest/shared';
import { QuizModel, type QuizRow } from '../models/quiz.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuestModel, type QuestRow } from '../models/quest.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { groupLabels } from '../utils/quiz-group.js';
import { randomId } from '../utils/random.js';

type Attachment = { questEdition: number; groupLabel: string };

/* Filled by quiz-config.services so this module never imports quests. */
export let beforeQuizSave: ((quizId: string, content: QuizContent) => Promise<void>) | null = null;
export function setBeforeQuizSave(hook: (quizId: string, content: QuizContent) => Promise<void>): void {
  beforeQuizSave = hook;
}
export let onQuizSaved: ((quizId: string) => Promise<void>) | null = null;
export function setOnQuizSaved(hook: (quizId: string) => Promise<void>): void {
  onQuizSaved = hook;
}

const STALE_MESSAGE = 'Someone else saved this quiz. Reload to see their version.';
const LOCKED_MESSAGE = 'Players have started this quiz, so it can no longer be changed.';

/* ── Attachment ─────────────────────────────────────────────────────────── */

function attachmentIn(quest: QuestRow | null, quizId: Types.ObjectId | string): Attachment | null {
  const config = quest?.quizConfig;
  const index = config?.quizzes.findIndex((id) => String(id) === String(quizId)) ?? -1;
  if (!quest || !config || index < 0) return null;
  return { questEdition: quest.edition, groupLabel: groupLabels(config.distribution, config.quizzes.length)[index]! };
}

async function findAttachment(quizId: Types.ObjectId | string): Promise<Attachment | null> {
  const quest = await QuestModel.findOne({ isCurrent: true, 'quizConfig.quizzes': quizId }).lean<QuestRow>();
  return attachmentIn(quest, quizId);
}

/** Past editions that referenced each quiz, from one query; pass `quizId` to narrow it to one. */
async function loadUsedInEditions(quizId?: Types.ObjectId | string): Promise<Map<string, number[]>> {
  const filter = quizId
    ? { isCurrent: { $ne: true }, 'quizConfig.quizzes': quizId }
    : { isCurrent: { $ne: true }, quizConfig: { $ne: null } };
  const quests = await QuestModel.find(filter, { edition: 1, 'quizConfig.quizzes': 1 })
    .sort({ edition: 1 })
    .lean<QuestRow[]>();
  const byQuiz = new Map<string, number[]>();
  for (const quest of quests) {
    for (const id of quest.quizConfig?.quizzes ?? []) {
      byQuiz.set(String(id), [...(byQuiz.get(String(id)) ?? []), quest.edition]);
    }
  }
  return byQuiz;
}

async function findUsedInEditions(quizId: Types.ObjectId | string): Promise<number[]> {
  return (await loadUsedInEditions(quizId)).get(String(quizId)) ?? [];
}

export async function isQuizLocked(quizId: Types.ObjectId | string): Promise<boolean> {
  return (await QuizAttemptModel.exists({ quiz: quizId })) !== null;
}

/* ── Mapping ────────────────────────────────────────────────────────────── */

/** Plain-typed content, which is what the shared helpers and the DTO both want. */
export function contentOf(quiz: QuizRow): QuizContent {
  return {
    settings: {
      shuffleQuestions: quiz.settings.shuffleQuestions,
      shuffleOptions: quiz.settings.shuffleOptions,
      defaultTimeLimitSec: quiz.settings.defaultTimeLimitSec
    },
    questions: quiz.questions.map((q) => ({
      id: q.id,
      type: q.type,
      prompt: q.prompt,
      options: q.options.map((o) => ({ id: o.id, text: o.text })),
      correctOptionId: q.correctOptionId ?? null,
      timeLimitSec: q.timeLimitSec ?? null,
      difficulty: q.difficulty,
      explanation: q.explanation ?? null
    }))
  };
}

function toAdminDto(
  quiz: QuizRow,
  extra: { locked: boolean; attachment: Attachment | null; usedIn: number[] }
): QuizAdmin {
  const content = contentOf(quiz);
  return {
    id: String(quiz._id),
    revision: quiz.revision,
    title: quiz.title,
    description: quiz.description ?? null,
    ...content,
    issues: findQuizIssues(content),
    locked: extra.locked,
    attachment: extra.attachment,
    usedIn: extra.usedIn,
    corrections: quiz.corrections.map((c) => ({
      questionId: c.questionId,
      kind: c.kind,
      from: c.from ?? null,
      to: c.to ?? null,
      note: c.note ?? null,
      by: String(c.by),
      at: c.at.toISOString()
    })),
    voidedQuestionIds: quiz.voidedQuestionIds,
    updatedAt: quiz.updatedAt.toISOString()
  };
}

async function toAdminDtoLoaded(quiz: QuizRow): Promise<QuizAdmin> {
  const [locked, attachment, usedIn] = await Promise.all([
    isQuizLocked(quiz._id),
    findAttachment(quiz._id),
    findUsedInEditions(quiz._id)
  ]);
  return toAdminDto(quiz, { locked, attachment, usedIn });
}

async function loadQuizOrThrow(id: string): Promise<QuizRow> {
  const quiz = await QuizModel.findById(id).lean<QuizRow>();
  if (!quiz) throw ApiError.notFound('Quiz not found.');
  return quiz;
}

/* ── Library ────────────────────────────────────────────────────────────── */

export async function listQuizzes(): Promise<QuizSummaryAdmin[]> {
  const [quizzes, lockedIds, current, usedIn] = await Promise.all([
    QuizModel.find().sort({ updatedAt: -1 }).lean<QuizRow[]>(),
    QuizAttemptModel.distinct('quiz'),
    QuestModel.findOne({ isCurrent: true }).lean<QuestRow>(),
    loadUsedInEditions()
  ]);
  const locked = new Set(lockedIds.map(String));

  return quizzes.map((quiz) => {
    const shape = quizShape(contentOf(quiz));
    const issues = findQuizIssues(contentOf(quiz));
    return {
      id: String(quiz._id),
      title: quiz.title,
      questionCount: shape.questionCount,
      totalSeconds: shape.totalSeconds,
      difficultyMix: shape.difficulty,
      isComplete: issues === null,
      issueCount: issues ? Object.keys(issues).length : 0,
      attachment: attachmentIn(current, quiz._id),
      usedIn: usedIn.get(String(quiz._id)) ?? [],
      locked: locked.has(String(quiz._id)),
      revision: quiz.revision,
      updatedAt: quiz.updatedAt.toISOString()
    };
  });
}

export async function createQuiz(payload: CreateQuizPayload, admin: UserDocument): Promise<QuizAdmin> {
  const created = await QuizModel.create({
    title: payload.title,
    description: payload.description,
    createdBy: admin._id
  });
  return toAdminDtoLoaded(created.toObject() as QuizRow);
}

export async function getQuizAdmin(id: string): Promise<QuizAdmin> {
  return toAdminDtoLoaded(await loadQuizOrThrow(id));
}

export async function saveQuiz(id: string, payload: SaveQuizPayload): Promise<QuizAdmin> {
  await loadQuizOrThrow(id);
  if (await isQuizLocked(id)) throw ApiError.conflict(LOCKED_MESSAGE, { reason: 'quiz_locked' });

  if (await findAttachment(id)) {
    const issues = findQuizIssues(payload);
    if (issues) {
      throw ApiError.badRequest('A quiz on the current quest must stay complete.', issues);
    }
  }

  const { revision, ...content } = payload;
  // Before the write, so a save that breaks variant shape never lands.
  if (beforeQuizSave) await beforeQuizSave(id, content);
  const updated = await QuizModel.findOneAndUpdate(
    { _id: id, revision },
    { $set: content, $inc: { revision: 1 } },
    { returnDocument: 'after' }
  ).lean<QuizRow>();
  if (!updated) throw ApiError.conflict(STALE_MESSAGE, { reason: 'stale' });

  if (onQuizSaved) await onQuizSaved(id);
  return toAdminDtoLoaded(updated);
}

export async function duplicateQuiz(id: string, admin: UserDocument): Promise<QuizAdmin> {
  const source = await loadQuizOrThrow(id);
  const copy = await QuizModel.create({
    title: `${source.title} (copy)`.slice(0, QUIZ_TEXT_LIMITS.title),
    description: source.description ?? null,
    settings: source.settings,
    questions: source.questions.map((q) => {
      // True/false options keep their fixed ids; only MCQ options are regenerated.
      const idMap = new Map<string, string>();
      const options = q.options.map((o) => {
        const next = q.type === 'mcq' ? randomId(8) : o.id;
        idMap.set(o.id, next);
        return { id: next, text: o.text };
      });
      return {
        ...q,
        id: randomId(10),
        options,
        correctOptionId: q.correctOptionId ? (idMap.get(q.correctOptionId) ?? null) : null
      };
    }),
    createdBy: admin._id
  });
  return toAdminDtoLoaded(copy.toObject() as QuizRow);
}

export async function deleteQuiz(id: string): Promise<void> {
  await loadQuizOrThrow(id);
  const [attachment, usedIn, locked] = await Promise.all([
    findAttachment(id),
    findUsedInEditions(id),
    isQuizLocked(id)
  ]);
  if (attachment) {
    throw ApiError.conflict('Detach this quiz from the quest before deleting it.', { reason: 'quiz_locked' });
  }
  if (usedIn.length > 0) throw ApiError.conflict('This quiz was used in an earlier edition, so it is kept.', { reason: 'quiz_locked' });
  if (locked) throw ApiError.conflict(LOCKED_MESSAGE, { reason: 'quiz_locked' });
  await QuizModel.deleteOne({ _id: id });
}

/* ── Attempt-time loader ────────────────────────────────────────────────── */

type QuizHead = Pick<QuizRow, 'revision' | 'voidedQuestionIds'>;

/** A quiz plus everything derived from it, computed once per revision. Shared: never mutate. */
export type AttemptQuiz = { quiz: QuizRow; content: QuizContent; valid: boolean; shape: QuizShape };

const CACHE_MAX = 16;
// Promises, so a start burst shares one read and one derivation per key (§15).
const quizCache = new Map<string, Promise<AttemptQuiz>>();
const headReads = new Map<string, Promise<QuizHead | null>>();

const cacheKey = (quizId: string, head: QuizHead) => `${quizId}:${head.revision}:${head.voidedQuestionIds.length}`;

/** Concurrent callers join one in-flight read; nothing is kept, so the next call reads afresh. */
function readHead(quizId: string): Promise<QuizHead | null> {
  const inFlight = headReads.get(quizId);
  if (inFlight) return inFlight;
  const read = QuizModel.findById(quizId, { revision: 1, voidedQuestionIds: 1 })
    .lean<QuizHead>()
    .exec()
    .finally(() => headReads.delete(quizId));
  headReads.set(quizId, read);
  return read;
}

async function buildAttemptQuiz(quizId: string, key: string): Promise<AttemptQuiz> {
  const quiz = await QuizModel.findById(quizId).lean<QuizRow>();
  if (!quiz) throw ApiError.notFound('Quiz not found.');
  // Saved between the head read and this one: serve it, but don't file it under the older key.
  if (cacheKey(quizId, quiz) !== key) quizCache.delete(key);
  const content = contentOf(quiz);
  return { quiz, content, valid: findQuizIssues(content) === null, shape: quizShape(content) };
}

/** Keyed by revision and void count, read per call, so a save or correction in any process invalidates it. */
export async function loadQuizForAttempt(quizId: string): Promise<AttemptQuiz> {
  const head = await readHead(quizId);
  if (!head) throw ApiError.notFound('Quiz not found.');

  const key = cacheKey(quizId, head);
  const cached = quizCache.get(key);
  if (cached) return cached;

  if (quizCache.size >= CACHE_MAX) quizCache.delete(quizCache.keys().next().value!);
  const build = buildAttemptQuiz(quizId, key);
  quizCache.set(key, build);
  // A failed read must not be served to everyone after it.
  build.catch(() => quizCache.delete(key));
  return build;
}
