import mongoose, { type ClientSession } from 'mongoose';
import { logger } from '../config/logger.js';

let capability: Promise<boolean> | null = null;

/**
 * Transactions need a replica set or a mongos. Atlas is always one; a local
 * `mongod` started plainly is neither, and it cannot even begin a transaction.
 *
 * Asked once and remembered: the answer cannot change without a reconnection,
 * and asking per call would add a round trip to every write that wants one.
 */
async function supportsTransactions(): Promise<boolean> {
  capability ??= (async () => {
    const admin = mongoose.connection.db?.admin();
    if (!admin) return false;

    const hello = await admin.command({ hello: 1 });
    // A replica set reports its name; a router identifies itself as isdbgrid.
    const supported = Boolean(hello.setName) || hello.msg === 'isdbgrid';

    if (!supported) {
      logger.warn(
        'MongoDB is a standalone server, so multi-document transactions are unavailable. Operations that want one will run unwrapped.'
      );
    }
    return supported;
  })().catch(() => false);

  return capability;
}

/**
 * Runs `work` inside a transaction where the deployment supports one, and
 * directly where it does not.
 *
 * Failing outright on a standalone server would make the feature undevelopable
 * offline, so the caller must order its writes such that the unwrapped path is
 * merely brief rather than corrupting.
 */
export async function withTransaction<T>(work: (session?: ClientSession) => Promise<T>): Promise<T> {
  if (!(await supportsTransactions())) return work();

  const session = await mongoose.startSession();
  try {
    let result!: T;
    await session.withTransaction(async () => {
      result = await work(session);
    });
    return result;
  } finally {
    await session.endSession();
  }
}
