/**
 * One-off: bring every Telegram registration up to the reader's current handle,
 * keeping the old one in `previousContacts`. Sign-ins do this from now on; this
 * catches up everyone registered before. Idempotent.
 *
 *   pnpm --filter @bookquest/api sync:telegram-contacts --dry-run   # lists changes only
 *   pnpm --filter @bookquest/api sync:telegram-contacts
 *
 * Production lives in the `bookquest` database on the same cluster as `.env`'s
 * default `test` — point MONGODB_URI at it explicitly for the real run.
 */
import mongoose from 'mongoose';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel } from '../models/user.model.js';
import { syncTelegramContact } from '../services/participant.services.js';
import { logger } from '../config/logger.js';

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();
  const database = mongoose.connection.db?.databaseName ?? 'unknown';

  const rows = await ParticipantModel.find({ 'contact.method': 'telegram' }, 'number contact user').lean();
  const users = await UserModel.find(
    { _id: { $in: rows.map((row) => row.user) }, username: { $nin: [null, ''] } },
    'username'
  ).lean();
  const handleOf = new Map(users.map((user) => [String(user._id), user.username!]));

  const stale = rows.filter((row) => {
    const handle = handleOf.get(String(row.user));
    return handle && row.contact.value.toLowerCase() !== `@${handle}`.toLowerCase();
  });
  for (const row of stale) {
    logger.info({ number: row.number, from: row.contact.value, to: `@${handleOf.get(String(row.user))}` }, 'update');
  }

  if (!dryRun) {
    for (const userId of new Set(stale.map((row) => String(row.user)))) {
      await syncTelegramContact(new mongoose.Types.ObjectId(userId), handleOf.get(userId));
    }
  }

  logger.info({ database, dryRun, updated: stale.length }, dryRun ? 'Dry run: nothing written' : 'Contacts synced');
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Contact sync failed');
  await disconnectFromDatabase();
  process.exit(1);
});
