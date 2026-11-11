/**
 * Dev only: fills the current quest with finishers so certificates can be
 * built before the quiz exists. Seeded numbers start at 3700, clear of real
 * registrations counting up from 3000, so a rerun appends.
 * Usage: pnpm --filter @bookquest/api seed:results [count]
 */
import { PARTICIPANT_NUMBER_MAX } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { isProduction } from '../config/env.js';
import { logger } from '../config/logger.js';
import { QuestModel } from '../models/quest.model.js';
import { ParticipantModel } from '../models/participant.model.js';
import { ResultModel } from '../models/result.model.js';
import { UserModel } from '../models/user.model.js';

const SEED_NUMBER_BASE = 3700;

// Edge cases the template must survive: Cyrillic, the longest realistic name, apostrophes.
const NAMES = [
  'Sofia Karimova',
  'Aziz Rahimov',
  'Malika Yusupova',
  'Bobur Tursunov',
  'Дилноза Абдуллаева',
  'Muhammadabdulaziz Abdurakhmonova',
  "Oybek O'g'ilov",
  'Nilufar Saidova'
];

async function run(): Promise<void> {
  if (isProduction) throw new Error('seed:results refuses to run in production.');
  const requested = Number(process.argv[2] ?? 40);

  await connectToDatabase();
  const quest = await QuestModel.findOne({ isCurrent: true });
  if (!quest) throw new Error('No current quest — run `pnpm --filter @bookquest/api seed` first.');

  const existing = await ParticipantModel.countDocuments({ quest: quest._id, number: { $gte: SEED_NUMBER_BASE } });
  const count = Math.min(requested, PARTICIPANT_NUMBER_MAX - SEED_NUMBER_BASE + 1 - existing);

  for (let i = existing; i < existing + count; i += 1) {
    const name = NAMES[i % NAMES.length]!;
    // No telegramUserId: these exercise the "in-app only" path unless linked by hand.
    const user = await UserModel.create({ firstName: name.split(' ')[0] });
    const participant = await ParticipantModel.create({
      number: SEED_NUMBER_BASE + i,
      fullName: name,
      contact: { method: 'phone', value: `+99890000${String(i).padStart(4, '0')}` },
      quest: quest._id,
      user: user._id
    });
    await ResultModel.create({
      quest: quest._id,
      participant: participant._id,
      score: 20 - (i % 15),
      total: 20,
      durationMs: 600_000 + i * 7_000,
      submittedAt: new Date(quest.quizOpensAt.getTime() + i * 1000)
    });
  }

  // Publish: results become visible, and rank lazily, on the next read.
  await QuestModel.updateOne({ _id: quest._id }, { $set: { resultsAt: new Date(Date.now() - 60_000) } });
  logger.info({ created: count, edition: quest.edition }, 'Seeded finishers and published results');
  await disconnectFromDatabase();
}

run().catch((error: unknown) => {
  logger.error({ err: error }, 'seed:results failed');
  process.exit(1);
});
