/**
 * One-off data changes for the 2026-11 audit fixes. Idempotent — safe to run twice.
 *   1. Reset every stored role (A1/A2): Telegram admins come from the env list;
 *      phone admins re-prove the shared password once. Also wipes any old A1 claim.
 *   2. Store phone numbers as `+<digits>` (B3). Collisions are reported, not merged.
 */
import { toCanonicalPhone } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { UserModel } from '../models/user.model.js';
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

async function main(): Promise<void> {
  await connectToDatabase();

  const rolesReset = await resetRoles();
  const { rewritten, collisions } = await normalisePhones();

  logger.info({ rolesReset, phonesRewritten: rewritten, collisions: collisions.length }, 'Audit migration done');
  for (const collision of collisions) logger.warn({ collision }, 'Phone collision — merge by hand');

  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Audit migration failed');
  await disconnectFromDatabase();
  process.exit(1);
});
