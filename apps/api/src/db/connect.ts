import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { logger } from '../config/logger.js';

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
}

export async function disconnectFromDatabase(): Promise<void> {
  await mongoose.disconnect();
}
