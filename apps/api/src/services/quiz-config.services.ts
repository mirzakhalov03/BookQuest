import crypto from 'node:crypto';
import type { Types } from 'mongoose';
import {
  QUIZ_GROUP_COUNTS,
  findQuizIssues,
  quizShape,
  sameShape,
  type QuizConfigInput,
  type QuizContent,
  type QuizDistribution,
  type QuizShape
} from '@bookquest/shared';
import { logger } from '../config/logger.js';
import { ParticipantModel } from '../models/participant.model.js';
import { QuestModel, type QuestDocument, type QuestRow } from '../models/quest.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { QuizModel, type QuizRow } from '../models/quiz.model.js';
import { ApiError } from '../utils/api-error.js';
import { resolveGroup } from '../utils/quiz-group.js';
import { contentOf, setBeforeQuizSave, setOnQuizSaved } from './quiz.services.js';

export type StoredQuizConfig = {
  distribution: QuizDistribution;
  quizzes: Types.ObjectId[];
  seed: string | null;
};
export type QuizSummary = { questionCount: number; totalSeconds: number };

const SHAPE_MESSAGE = 'Variants must match: same number of questions, same difficulty mix, same total time.';

/* ── Locks ──────────────────────────────────────────────────────────────── */

/** Quest-level locks key off attempt existence, not the clock (§13.6). */
export async function questHasAttempts(questId: Types.ObjectId | string): Promise<boolean> {
  return (await QuizAttemptModel.exists({ quest: questId })) !== null;
}

/* ── Config validation ──────────────────────────────────────────────────── */

const configError = (message: string): ApiError => ApiError.badRequest(message, { quizConfig: message });

function countMessage(distribution: QuizDistribution): string {
  const { min, max } = QUIZ_GROUP_COUNTS[distribution];
  const n = min === max ? String(min) : `${min}–${max}`;
  return `Choose ${n} ${max === 1 ? 'quiz' : 'quizzes'} for this split.`;
}

function readinessMessage(title: string, issues: Record<string, string>): string {
  const questions = new Set(Object.keys(issues).flatMap((key) => key.match(/^questions\.(\d+)\./)?.[1] ?? []));
  if (questions.size === 0) return `“${title}” isn't ready — it has no questions yet.`;
  const k = questions.size;
  return `“${title}” isn't ready — ${k} ${k === 1 ? 'question needs' : 'questions need'} attention.`;
}

function formatSeconds(total: number): string {
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return seconds === 0 ? `${minutes} min` : `${minutes} min ${seconds} s`;
}

function describeShape(title: string, shape: QuizShape): string {
  const { easy, medium, hard } = shape.difficulty;
  return `“${title}”: ${shape.questionCount} questions (${easy} easy, ${medium} medium, ${hard} hard), ${formatSeconds(shape.totalSeconds)}`;
}

/** Null when every shape matches the first; otherwise the message naming each variant's shape. */
function shapeMismatch(variants: { title: string; shape: QuizShape }[]): string | null {
  const [first] = variants;
  if (!first || variants.every((v) => sameShape(first.shape, v.shape))) return null;
  return `${SHAPE_MESSAGE} ${variants.map((v) => describeShape(v.title, v.shape)).join('; ')}.`;
}

/** Quizzes in the order of `ids`; throws if any is gone. */
async function loadQuizzesInOrder(ids: string[]): Promise<QuizRow[]> {
  const found = await QuizModel.find({ _id: { $in: ids } }).lean<QuizRow[]>();
  const byId = new Map(found.map((quiz) => [String(quiz._id), quiz]));
  return ids.map((id) => {
    const quiz = byId.get(id);
    if (!quiz) throw configError('One of those quizzes no longer exists.');
    return quiz;
  });
}

/** A quiz belongs to one live edition: the current one, or any whose results are still to come. */
async function assertNotUsedElsewhere(quest: QuestDocument, quizzes: QuizRow[]): Promise<void> {
  const others = await QuestModel.find(
    {
      _id: { $ne: quest._id },
      'quizConfig.quizzes': { $in: quizzes.map((quiz) => quiz._id) },
      $or: [{ isCurrent: true }, { resultsAt: { $gt: new Date() } }]
    },
    { 'quizConfig.quizzes': 1 }
  ).lean<QuestRow[]>();
  const taken = new Set(others.flatMap((other) => (other.quizConfig?.quizzes ?? []).map(String)));
  const clash = quizzes.find((quiz) => taken.has(String(quiz._id)));
  if (clash) throw configError(`“${clash.title}” is already used by another edition. Duplicate it instead.`);
}

/** Validates per §13.6 and derives the stored config plus the public summary. */
export async function buildQuizConfig(
  quest: QuestDocument,
  input: QuizConfigInput | null
): Promise<{ quizConfig: StoredQuizConfig | null; quizSummary: QuizSummary | null }> {
  if (!input) return { quizConfig: null, quizSummary: null };

  const { min, max } = QUIZ_GROUP_COUNTS[input.distribution];
  if (input.quizIds.length < min || input.quizIds.length > max) throw configError(countMessage(input.distribution));
  if (new Set(input.quizIds).size !== input.quizIds.length) throw configError('Pick a different quiz for each group.');

  const quizzes = await loadQuizzesInOrder(input.quizIds);
  const variants = quizzes.map((quiz) => {
    const content = contentOf(quiz);
    const issues = findQuizIssues(content);
    if (issues) throw configError(readinessMessage(quiz.title, issues));
    return { title: quiz.title, shape: quizShape(content) };
  });

  await assertNotUsedElsewhere(quest, quizzes);

  const mismatch = shapeMismatch(variants);
  if (mismatch) throw configError(mismatch);

  // Kept while the split stays random, so nobody's group moves on an unrelated save.
  const savedSeed = quest.quizConfig?.distribution === 'random' ? (quest.quizConfig.seed ?? null) : null;
  const seed = input.distribution === 'random' ? (savedSeed ?? crypto.randomBytes(32).toString('hex')) : null;

  const shape = variants[0]!.shape;
  return {
    quizConfig: { distribution: input.distribution, quizzes: quizzes.map((quiz) => quiz._id), seed },
    quizSummary: { questionCount: shape.questionCount, totalSeconds: shape.totalSeconds }
  };
}

/* ── Quiz-save hooks ────────────────────────────────────────────────────── */

async function findCurrentQuestWithQuiz(quizId: string): Promise<QuestRow | null> {
  return QuestModel.findOne({ isCurrent: true, 'quizConfig.quizzes': quizId }).lean<QuestRow>();
}

/** Runs before a quiz save writes: an attached variant must keep its siblings' shape. */
export async function assertSiblingShape(quizId: string, content: QuizContent): Promise<void> {
  const quest = await findCurrentQuestWithQuiz(quizId);
  const ids = (quest?.quizConfig?.quizzes ?? []).map(String);
  if (ids.length < 2) return;

  const quizzes = await loadQuizzesInOrder(ids);
  const variants = quizzes.map((quiz) => ({
    title: quiz.title,
    shape: quizShape(String(quiz._id) === quizId ? content : contentOf(quiz))
  }));
  const mismatch = shapeMismatch(variants);
  if (mismatch) throw ApiError.badRequest(mismatch, { questions: mismatch });
}

/** Recomputes the current quest's summary after an attached quiz is saved. */
export async function refreshSummaryForQuiz(quizId: string): Promise<void> {
  const quest = await findCurrentQuestWithQuiz(quizId);
  const ids = (quest?.quizConfig?.quizzes ?? []).map(String);
  if (!quest || ids.length === 0) return;

  const quizzes = await loadQuizzesInOrder(ids);
  const variants = quizzes.map((quiz) => ({ title: quiz.title, shape: quizShape(contentOf(quiz)) }));
  // assertSiblingShape blocks this; reaching it means a write bypassed the service.
  if (shapeMismatch(variants)) logger.warn({ edition: quest.edition }, 'Attached quiz variants differ in shape');

  const shape = variants[0]!.shape;
  await QuestModel.updateOne(
    { _id: quest._id },
    { $set: { quizSummary: { questionCount: shape.questionCount, totalSeconds: shape.totalSeconds } } }
  );
}

setBeforeQuizSave(assertSiblingShape);
setOnQuizSaved(refreshSummaryForQuiz);

/* ── Group sizes ────────────────────────────────────────────────────────── */

/** Live split of the current roster; null for `random` until a seed is saved. */
export async function groupSizes(
  quest: QuestDocument,
  distribution: QuizDistribution,
  groupCount: number
): Promise<number[] | null> {
  if (distribution === 'single') return [await ParticipantModel.countDocuments({ quest: quest._id })];

  if (distribution === 'parity') {
    const counts = await ParticipantModel.aggregate<{ _id: number; n: number }>([
      { $match: { quest: quest._id } },
      { $group: { _id: { $mod: ['$number', 2] }, n: { $sum: 1 } } }
    ]);
    const of = (parity: number) => counts.find((row) => row._id === parity)?.n ?? 0;
    return [of(1), of(0)];
  }

  const seed = quest.quizConfig?.distribution === 'random' ? (quest.quizConfig.seed ?? null) : null;
  if (!seed) return null;

  // ≤ 1000 rows per edition, so hashing in-process beats a pipeline.
  const roster = await ParticipantModel.find({ quest: quest._id }, { number: 1 }).lean();
  const config = { distribution, quizzes: Array.from({ length: groupCount }), seed };
  const sizes = Array.from({ length: groupCount }, () => 0);
  for (const participant of roster) sizes[resolveGroup(config, participant)]! += 1;
  return sizes;
}
