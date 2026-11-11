import { Types } from 'mongoose';
import {
  QUIZ_TEXT_LIMITS,
  findQuizIssues,
  quizShape,
  type CreateQuizPayload,
  type QuizContent,
  type QuizAdmin,
  type QuizSummaryAdmin,
  type SaveQuizPayload
} from '@bookquest/shared';
import { QuizModel, type QuizRow } from '../models/quiz.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuestModel } from '../models/quest.model.js';
import type { UserDocument } from '../models/user.model.js';
import { ApiError } from '../utils/api-error.js';
import { randomId } from '../utils/random.js';

type Attachment = { questEdition: number; groupLabel: string };

/** Quest fields Task 6 adds; read loosely until then. */
type QuestQuizRef = { edition: number; quizConfig?: { distribution?: string; quizzes?: Types.ObjectId[] } };

/** Filled by the quest service so this module never imports quests. */
export let onQuizSaved: ((quizId: string) => Promise<void>) | null = null;
export function setOnQuizSaved(hook: (quizId: string) => Promise<void>): void {
  onQuizSaved = hook;
}

const STALE_MESSAGE = 'Someone else saved this quiz. Reload to see their version.';
const LOCKED_MESSAGE = 'Players have started this quiz, so it can no longer be changed.';

/* ── Attachment ─────────────────────────────────────────────────────────── */

function groupLabel(distribution: string | undefined, index: number): string {
  if (distribution === 'single') return 'Everyone';
  if (distribution === 'parity') return index === 0 ? 'Odd numbers' : 'Even numbers';
  return `Group ${index + 1}`;
}

/* `quizConfig` isn't on the Quest schema yet, and the app-wide strictQuery would
   silently drop the filter and match the current quest for every quiz. Loose
   queries also skip casting, so ids must be ObjectIds here. */
const LOOSE = { strictQuery: false } as const;

async function findAttachment(quizId: Types.ObjectId | string): Promise<Attachment | null> {
  const quest = await QuestModel.findOne({ isCurrent: true, 'quizConfig.quizzes': new Types.ObjectId(String(quizId)) })
    .setOptions(LOOSE)
    .lean<QuestQuizRef>();
  const index = quest?.quizConfig?.quizzes?.findIndex((id) => String(id) === String(quizId)) ?? -1;
  if (!quest || index < 0) return null;
  return { questEdition: quest.edition, groupLabel: groupLabel(quest.quizConfig?.distribution, index) };
}

async function findUsedInEditions(quizId: Types.ObjectId | string): Promise<number[]> {
  const quests = await QuestModel.find({ isCurrent: { $ne: true }, 'quizConfig.quizzes': new Types.ObjectId(String(quizId)) }, { edition: 1 })
    .setOptions(LOOSE)
    .sort({ edition: 1 })
    .lean<{ edition: number }[]>();
  return quests.map((q) => q.edition);
}

export async function isQuizLocked(quizId: Types.ObjectId | string): Promise<boolean> {
  return (await QuizAttemptModel.exists({ quiz: quizId })) !== null;
}

/* ── Mapping ────────────────────────────────────────────────────────────── */

/** Plain-typed content, which is what the shared helpers and the DTO both want. */
function contentOf(quiz: QuizRow): QuizContent {
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
  const [quizzes, lockedIds, quests] = await Promise.all([
    QuizModel.find().sort({ updatedAt: -1 }).lean<QuizRow[]>(),
    QuizAttemptModel.distinct('quiz'),
    QuestModel.findOne({ isCurrent: true }).setOptions(LOOSE).lean<QuestQuizRef>()
  ]);
  const locked = new Set(lockedIds.map(String));
  const attached = new Map<string, Attachment>();
  quests?.quizConfig?.quizzes?.forEach((id, i) =>
    attached.set(String(id), { questEdition: quests.edition, groupLabel: groupLabel(quests.quizConfig?.distribution, i) })
  );

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
      attachment: attached.get(String(quiz._id)) ?? null,
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
  if (attachment) throw ApiError.conflict('Detach this quiz from the quest before deleting it.');
  if (usedIn.length > 0) throw ApiError.conflict('This quiz was used in an earlier edition, so it is kept.', { reason: 'quiz_locked' });
  if (locked) throw ApiError.conflict(LOCKED_MESSAGE, { reason: 'quiz_locked' });
  await QuizModel.deleteOne({ _id: id });
}

/* ── Attempt-time loader ────────────────────────────────────────────────── */

const quizCache = new Map<string, QuizRow>();
const CACHE_MAX = 16;

/** Keyed by revision and void count, so a save or correction invalidates it by itself. */
export async function loadQuizForAttempt(quizId: string): Promise<QuizRow> {
  const head = await QuizModel.findById(quizId, { revision: 1, voidedQuestionIds: 1 }).lean<
    Pick<QuizRow, 'revision' | 'voidedQuestionIds'>
  >();
  if (!head) throw ApiError.notFound('Quiz not found.');

  const key = `${quizId}:${head.revision}:${head.voidedQuestionIds.length}`;
  const hit = quizCache.get(key);
  if (hit) return hit;

  const quiz = await QuizModel.findById(quizId).lean<QuizRow>();
  if (!quiz) throw ApiError.notFound('Quiz not found.');
  if (quizCache.size >= CACHE_MAX) quizCache.delete(quizCache.keys().next().value!);
  quizCache.set(key, quiz);
  return quiz;
}
