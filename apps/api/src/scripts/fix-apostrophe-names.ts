/**
 * One-off: undo the old title-casing that capitalised after apostrophes
 * ("Sug'Diyona" -> "Sug'diyona"). Only rewrites a name the old formatter could
 * have produced, so anything else is left alone. Idempotent.
 *
 *   pnpm --filter @bookquest/api fix:apostrophe-names --dry-run   # lists changes only
 *   pnpm --filter @bookquest/api fix:apostrophe-names
 *
 * Production lives in the `bookquest` database on the same cluster as `.env`'s
 * default `test` — point MONGODB_URI at it explicitly for the real run.
 */
import mongoose, { type Model } from 'mongoose';
import { titleCaseWord } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { ParticipantModel } from '../models/participant.model.js';
import { UserModel } from '../models/user.model.js';
import { logger } from '../config/logger.js';

// The formatter as it was before the fix.
const oldTitleCaseWord = (word: string) =>
  word
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase())
    .replace(/^Mc(\p{L})/u, (_, ch: string) => 'Mc' + ch.toUpperCase());

const APOSTROPHE_THEN_CAPITAL = /\p{L}['’]\p{Lu}/u;

const recase = (name: string, fn: (w: string) => string) => name.split(' ').map(fn).join(' ');

/** The corrected name, or null when this name wasn't damaged by the old rule. */
function repaired(name: string): string | null {
  if (!APOSTROPHE_THEN_CAPITAL.test(name) || recase(name, oldTitleCaseWord) !== name) return null;
  const fixed = recase(name, titleCaseWord);
  return fixed === name ? null : fixed;
}

async function fixField(label: string, model: Model<any>, field: string, filter: object, dryRun: boolean) {
  // Coarse in Mongo (no reliable \p{} there), exact in `repaired`.
  const docs = await model.find({ ...filter, [field]: /['’]/ }, `_id ${field}`).lean<Record<string, any>[]>();
  const changes = docs.flatMap((doc) => {
    const to = repaired(doc[field]);
    return to ? [{ _id: doc._id, from: doc[field] as string, to }] : [];
  });

  for (const c of changes) logger.info({ collection: label, from: c.from, to: c.to }, 'rename');
  if (dryRun || changes.length === 0) return changes.length;

  const { modifiedCount } = await model.bulkWrite(
    // Filter on the old value so a name edited since the scan is not overwritten.
    changes.map((c) => ({ updateOne: { filter: { _id: c._id, [field]: c.from }, update: { $set: { [field]: c.to } } } }))
  );
  return modifiedCount;
}

async function main(): Promise<void> {
  const dryRun = process.argv.includes('--dry-run');
  await connectToDatabase();
  const database = mongoose.connection.db?.databaseName ?? 'unknown';
  logger.info({ database, dryRun }, 'Fixing apostrophe capitalisation');

  const participants = await fixField('participants', ParticipantModel, 'fullName', {}, dryRun);
  // Telegram names come from Telegram as typed; only phone sign-ups went through the formatter.
  const users = await fixField('users', UserModel, 'firstName', { telegramUserId: { $exists: false } }, dryRun);

  logger.info({ database, dryRun, participants, users }, dryRun ? 'Dry run: nothing written' : 'Names fixed');
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Name fix failed');
  await disconnectFromDatabase();
  process.exit(1);
});
