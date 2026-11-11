/**
 * Dev only: two matching sample quizzes attached to the current quest as an
 * odd/even split, so the quiz flow has something to play. Safe to run repeatedly;
 * refuses once anyone has started, because the config is locked from then on.
 */
import { QUESTION_DIFFICULTIES, TRUE_FALSE_OPTION_IDS, type QuestionDifficulty } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { QuestModel } from '../models/quest.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { UserModel } from '../models/user.model.js';
import { buildQuizConfig, questHasAttempts } from '../services/quiz-config.services.js';
import { logger } from '../config/logger.js';

const QUESTION_COUNT = 20;
const TIME_LIMIT_SEC = 30;
// 6 easy / 8 medium / 6 hard, with true/false spread across difficulties.
const DIFFICULTY_COUNTS: Record<QuestionDifficulty, number> = { easy: 6, medium: 8, hard: 6 };
const TRUE_FALSE_AT = new Set([0, 5, 10, 15]);

function difficultyAt(index: number): QuestionDifficulty {
  let upTo = 0;
  for (const difficulty of QUESTION_DIFFICULTIES) {
    upTo += DIFFICULTY_COUNTS[difficulty];
    if (index < upTo) return difficulty;
  }
  return 'hard';
}

function sampleQuestions(variant: string, bookTitle: string) {
  return Array.from({ length: QUESTION_COUNT }, (_, i) => {
    const n = i + 1;
    const difficulty = difficultyAt(i);
    if (TRUE_FALSE_AT.has(i)) {
      return {
        id: `${variant.toLowerCase()}q${n}`,
        type: 'true_false' as const,
        prompt: `[${variant}${n}] True or false: “${bookTitle}” is this edition's book.`,
        options: TRUE_FALSE_OPTION_IDS.map((id) => ({ id, text: id === 'true' ? 'True' : 'False' })),
        correctOptionId: 'true',
        timeLimitSec: TIME_LIMIT_SEC,
        difficulty,
        explanation: null
      };
    }
    const correct = ['a', 'b', 'c', 'd'][i % 4]!;
    return {
      id: `${variant.toLowerCase()}q${n}`,
      type: 'mcq' as const,
      prompt: `[${variant}${n}] A ${difficulty} sample question about “${bookTitle}”. Pick option ${correct.toUpperCase()}.`,
      options: ['a', 'b', 'c', 'd'].map((id) => ({ id, text: `Option ${id.toUpperCase()}` })),
      correctOptionId: correct,
      timeLimitSec: TIME_LIMIT_SEC,
      difficulty,
      explanation: `The prompt names option ${correct.toUpperCase()}.`
    };
  });
}

async function upsertSampleQuiz(variant: string, bookTitle: string, createdBy: unknown) {
  return QuizModel.findOneAndUpdate(
    { title: `Sample quiz ${variant}` },
    {
      $set: {
        description: `Dev sample for “${bookTitle}”.`,
        settings: { shuffleQuestions: true, shuffleOptions: true, defaultTimeLimitSec: TIME_LIMIT_SEC },
        questions: sampleQuestions(variant, bookTitle)
      },
      $inc: { revision: 1 },
      $setOnInsert: { createdBy }
    },
    { upsert: true, returnDocument: 'after' }
  );
}

async function main(): Promise<void> {
  await connectToDatabase();

  const quest = await QuestModel.findOne({ isCurrent: true });
  if (!quest) throw new Error('No current quest. Run `seed` first.');
  if (await questHasAttempts(quest._id)) {
    logger.warn({ edition: quest.edition }, 'Participants have started this quest; its quiz setup is locked. Nothing seeded.');
    return disconnectFromDatabase();
  }

  const admin = (await UserModel.findOne({ role: 'admin' })) ?? (await UserModel.findOne());
  if (!admin) throw new Error('No user to own the quizzes. Sign in once first.');

  const a = await upsertSampleQuiz('A', quest.book.title, admin._id);
  const b = await upsertSampleQuiz('B', quest.book.title, admin._id);

  const built = await buildQuizConfig(quest, { distribution: 'parity', quizIds: [a.id, b.id] });
  await QuestModel.updateOne({ _id: quest._id }, { $set: built });

  logger.info({ edition: quest.edition, quizzes: [a.id, b.id], summary: built.quizSummary }, 'Seeded sample quizzes (parity)');
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Quiz seed failed');
  await disconnectFromDatabase();
  process.exit(1);
});
