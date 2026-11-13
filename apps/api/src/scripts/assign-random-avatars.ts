/**
 * One-off, before launch: every user with no valid mascot (null, missing, or a
 * retired id like `chick`) gets a random one. Idempotent: each write re-checks
 * the filter, so a re-run reports 0.
 *
 *   pnpm --filter @bookquest/api migrate:avatars --dry-run   # counts only
 *   pnpm --filter @bookquest/api migrate:avatars
 *
 * Production lives in the `bookquest` database on the same cluster as `.env`'s
 * default `test` — point MONGODB_URI at it explicitly for the real run.
 */
import mongoose from 'mongoose';
import { AVATARS } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { UserModel } from '../models/user.model.js';
import { randomAvatar } from '../utils/randomAvatar.js';
import { logger } from '../config/logger.js';

const NEEDS_MASCOT = { $or: [{ avatar: null }, { avatar: { $exists: false } }, { avatar: { $nin: [...AVATARS] } }] };

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();
  const database = mongoose.connection.db?.databaseName ?? 'unknown';
  logger.info({ database, dryRun }, 'Assigning random mascots');

  const users = await UserModel.find(NEEDS_MASCOT, '_id').lean();
  if (dryRun || users.length === 0) {
    logger.info({ database, needMascot: users.length }, dryRun ? 'Dry run: nothing written' : 'Nothing to do');
    return disconnectFromDatabase();
  }

  const { modifiedCount } = await UserModel.bulkWrite(
    users.map((user) => ({
      updateOne: { filter: { _id: user._id, ...NEEDS_MASCOT }, update: { $set: { avatar: randomAvatar() } } }
    }))
  );
  logger.info({ database, assigned: modifiedCount }, 'Mascots assigned');
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Mascot assignment failed');
  await disconnectFromDatabase();
  process.exit(1);
});
