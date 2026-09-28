import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';
import { UserModel } from '../models/user.model.js';

/**
 * One connection for the process lifetime. Mongoose pools internally, so
 * connecting per request would only add latency.
 */
export async function connectToDatabase(): Promise<void> {
  mongoose.set('strictQuery', true);

  mongoose.connection.on('error', (error) => logger.error({ error }, 'MongoDB connection error'));
  mongoose.connection.on('disconnected', () => logger.warn('MongoDB disconnected'));

  await mongoose.connect(env.MONGODB_URI);
  logger.info('MongoDB connected');

  /**
   * Mongoose's default background index build refuses to replace an index
   * whose options changed under the same auto-generated name (both raise
   * an index-build error event instead of throwing, so a boot with a stale
   * index looks identical to a clean one). `syncIndexes` explicitly drops
   * anything not in the current schema and creates what's missing, so a
   * database that predates the User model's partial unique indexes heals
   * itself on the next deploy instead of silently keeping the old ones.
   * Cheap at this project's scale; revisit if the collection ever grows
   * large enough for an index rebuild to be felt on every boot.
   */
  await UserModel.syncIndexes();
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
