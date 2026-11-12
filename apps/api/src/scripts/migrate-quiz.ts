/**
 * Quiz feature data changes (§18). Idempotent — safe to run twice.
 *   1. Drop the old free-text meta fields (quizQuestionCount, quizDurationMinutes).
 *   2. Give every quest an explicit `quizConfig: null` / `quizSummary: null`.
 *   3. Build the quiz, attempt and quest indexes.
 *   4. Warn if the current quest's results land inside the 5-minute buffer.
 */
import { QUIZ_RESULTS_BUFFER_MS } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { QuestModel } from '../models/quest.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { QuizAttemptModel } from '../models/quiz-attempt.model.js';
import { logger } from '../config/logger.js';

// The native collection: the dropped fields are no longer in the schema, so strict mode would discard them.
async function migrateQuestFields(): Promise<{ metaUnset: number; configAdded: number; summaryAdded: number }> {
  const quests = QuestModel.collection;
  const meta = await quests.updateMany(
    { $or: [{ quizQuestionCount: { $exists: true } }, { quizDurationMinutes: { $exists: true } }] },
    { $unset: { quizQuestionCount: '', quizDurationMinutes: '' } }
  );
  const config = await quests.updateMany({ quizConfig: { $exists: false } }, { $set: { quizConfig: null } });
  const summary = await quests.updateMany({ quizSummary: { $exists: false } }, { $set: { quizSummary: null } });
  return { metaUnset: meta.modifiedCount, configAdded: config.modifiedCount, summaryAdded: summary.modifiedCount };
}

async function buildIndexes(): Promise<Record<string, string[] | boolean>> {
  const [quiz, attempt] = await Promise.all([QuizModel.syncIndexes(), QuizAttemptModel.syncIndexes()]);
  // Additive only: syncIndexes would drop any index on the live quests collection that the schema doesn't declare.
  await QuestModel.createIndexes();
  // syncIndexes returns the dropped index names; both collections are new and fully schema-owned.
  return { quizDropped: quiz, attemptDropped: attempt, questIndexesEnsured: true };
}

async function warnOnTightResults(): Promise<void> {
  const quest = await QuestModel.findOne({ isCurrent: true }, { edition: 1, quizClosesAt: 1, resultsAt: 1 }).lean();
  if (quest && quest.resultsAt.getTime() < quest.quizClosesAt.getTime() + QUIZ_RESULTS_BUFFER_MS) {
    logger.warn(
      { edition: quest.edition },
      `Edition ${quest.edition}: results are less than 5 minutes after the quiz closes. Move resultsAt later before the quiz.`
    );
  }
}

async function main(): Promise<void> {
  await connectToDatabase();

  const fields = await migrateQuestFields();
  const indexes = await buildIndexes();
  await warnOnTightResults();

  logger.info({ ...fields, ...indexes }, 'Quiz migration done');
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Quiz migration failed');
  await disconnectFromDatabase();
  process.exit(1);
});
