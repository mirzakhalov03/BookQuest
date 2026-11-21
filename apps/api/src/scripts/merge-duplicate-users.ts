/**
 * One-off clean-up: a phone-only account whose current-quest registration names a Telegram
 * handle that a real Telegram account (verified `username`) owns is the same person who
 * signed up twice. Dry run by default; `--apply` merges each pair (the Telegram one survives).
 *
 *   pnpm --filter @bookquest/api merge:duplicates            # prints the pairs
 *   pnpm --filter @bookquest/api merge:duplicates --apply
 *
 * Production lives in the `bookquest` database — point MONGODB_URI at it explicitly.
 */
import mongoose from 'mongoose';
import { parseTelegramUsername } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { logger } from '../config/logger.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel } from '../models/user.model.js';
import { mergeUsers } from '../services/account-merge.services.js';
import { requireCurrentQuestDocument } from '../services/quest.services.js';

async function main(): Promise<void> {
  const apply = process.argv.includes('--apply');
  await connectToDatabase();
  const database = mongoose.connection.db?.databaseName ?? 'unknown';
  const quest = await requireCurrentQuestDocument();

  const telegramEntries = await ParticipantModel.find({ quest: quest._id, 'contact.method': 'telegram' });
  const pairs: { drop: string; keep: string; label: string }[] = [];

  for (const entry of telegramEntries) {
    const owner = await UserModel.findById(entry.user);
    if (!owner || owner.telegramUserId) continue; // only phone-only accounts can be the duplicate
    const parsed = parseTelegramUsername(entry.contact.value);
    if (!parsed.ok) continue;
    const tg = await UserModel.findOne({ username: new RegExp(`^@?${parsed.value.slice(1)}$`, 'i'), telegramUserId: { $type: 'string' } });
    if (!tg) continue;
    const tgEntry = await ParticipantModel.findOne({ quest: quest._id, user: tg._id }, 'number');
    pairs.push({ drop: owner.id, keep: tg.id, label: `#${entry.number} (phone) → ${tgEntry ? `#${tgEntry.number}` : 'no entry'} (@${tg.username})` });
  }

  logger.info({ database, apply, pairs: pairs.map((p) => p.label) }, `Found ${pairs.length} duplicate pair(s)`);
  if (apply) {
    for (const pair of pairs) {
      const [keep, drop] = await Promise.all([UserModel.findById(pair.keep), UserModel.findById(pair.drop)]);
      if (!keep || !drop) continue;
      try {
        await mergeUsers(keep, drop);
        logger.info({ pair: pair.label }, 'Merged');
      } catch (error) {
        logger.warn({ pair: pair.label, error: (error as Error).message }, 'Skipped');
      }
    }
  }
  await disconnectFromDatabase();
}

void main();
