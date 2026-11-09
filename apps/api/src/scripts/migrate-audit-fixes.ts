/**
 * One-off data changes for the 2026-11 audit fixes. Idempotent — safe to run twice.
 *   1. Reset every stored role (A1/A2): Telegram admins come from the env list;
 *      phone admins re-prove the shared password once. Also wipes any old A1 claim.
 *   2. Store phone numbers as `+<digits>` (B3). Collisions are reported, not merged.
 *   3. Store our own cover URLs as a path, whatever origin they were saved under (Q1).
 */
import { toCanonicalPhone } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { UserModel } from '../models/user.model.js';
import { QuestModel } from '../models/quest.model.js';
import { COVER_PATH } from '../services/cover.services.js';
import { logger } from '../config/logger.js';

async function resetRoles(): Promise<number> {
  const { modifiedCount } = await UserModel.updateMany(
    { role: { $ne: 'participant' } },
    { $set: { role: 'participant' } }
  );
  return modifiedCount;
}

async function normalisePhones(): Promise<{ rewritten: number; collisions: string[] }> {
  const users = await UserModel.find({ phoneNumber: { $type: 'string' } }, 'phoneNumber').lean();
  const taken = new Set(users.map((user) => user.phoneNumber));
  const collisions: string[] = [];
  let rewritten = 0;

  for (const user of users) {
    const current = user.phoneNumber!;
    const canonical = toCanonicalPhone(current);
    if (canonical === current) continue;

    if (taken.has(canonical)) {
      collisions.push(`${String(user._id)}: ${current} → ${canonical} already exists`);
      continue;
    }

    await UserModel.updateOne({ _id: user._id }, { $set: { phoneNumber: canonical } });
    taken.delete(current);
    taken.add(canonical);
    rewritten += 1;
  }

  return { rewritten, collisions };
}

// Any origin: the point is to recover covers saved under a domain the API no longer has.
const ABSOLUTE_COVER_URL = new RegExp(`^https?://[^/]+(${COVER_PATH}[0-9a-f]{24})$`, 'i');

async function relativiseCovers(): Promise<number> {
  const quests = await QuestModel.find({ 'book.coverUrl': { $regex: '^https?://' } }, 'book.coverUrl').lean();
  let rewritten = 0;
  for (const quest of quests) {
    const path = ABSOLUTE_COVER_URL.exec(quest.book.coverUrl ?? '')?.[1];
    if (!path) continue;
    await QuestModel.updateOne({ _id: quest._id }, { $set: { 'book.coverUrl': path } });
    rewritten += 1;
  }
  return rewritten;
}

async function main(): Promise<void> {
  await connectToDatabase();

  const rolesReset = await resetRoles();
  const { rewritten, collisions } = await normalisePhones();
  const coversRewritten = await relativiseCovers();

  logger.info(
    { rolesReset, phonesRewritten: rewritten, collisions: collisions.length, coversRewritten },
    'Audit migration done'
  );
  for (const collision of collisions) logger.warn({ collision }, 'Phone collision — merge by hand');

  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Audit migration failed');
  await disconnectFromDatabase();
  process.exit(1);
});
