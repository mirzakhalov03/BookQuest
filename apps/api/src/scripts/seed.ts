/**
 * Seeds the quest the prototype is designed around, so a fresh clone has
 * something to render. Safe to run repeatedly.
 */
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { QuestModel } from '../models/quest.model.js';
// Imported for their side effect: a model must be registered to be synced.
import '../models/participant.model.js';
import '../models/user.model.js';
import '../models/result.model.js';
import '../models/counter.model.js';
import { logger } from '../config/logger.js';

const QUEST = {
  edition: 4,
  year: 2026,
  book: {
    title: 'The Alchemist',
    author: 'Paulo Coelho',
    pages: 197,
    coverUrl: null,
    description:
      'A shepherd boy leaves everything he knows to follow a recurring dream. Short, plain-spoken, and about the cost of actually going.',
    resources: []
  },
  prizes: {
    first: null,
    second: null,
    third: null
  },
  opensAt: new Date('2026-08-01T09:00:00Z'),
  readingDeadline: new Date('2026-10-10T18:59:00Z'),
  quizOpensAt: new Date('2026-10-11T13:00:00Z'),
  quizClosesAt: new Date('2026-10-11T15:00:00Z'),
  resultsAt: new Date('2026-10-12T07:00:00Z'),
  quizQuestionCount: 20,
  quizDurationMinutes: 30,
  isCurrent: true
};

async function seed(): Promise<void> {
  await connectToDatabase();

  /* Indexes changed with the auth work — notably a participant's contact is no
     longer unique, and only one quest may be current. syncIndexes drops what no
     longer exists and builds what does. It belongs in a development bootstrap:
     on a production database, index changes are a deliberate migration step. */
  await Promise.all(Object.values(mongoose.models).map((model) => model.syncIndexes()));
  logger.info('Indexes synced');

  await QuestModel.updateMany(
    { isCurrent: true, edition: { $ne: QUEST.edition } },
    { $set: { isCurrent: false } }
  );

  const quest = await QuestModel.findOneAndUpdate(
    { edition: QUEST.edition },
    { $set: QUEST },
    { returnDocument: 'after', upsert: true }
  );

  logger.info({ edition: quest?.edition, book: quest?.book.title }, 'Seeded current quest');
  await disconnectFromDatabase();
}

seed().catch((error: unknown) => {
  logger.error({ err: error }, 'Seed failed');
  process.exit(1);
});
