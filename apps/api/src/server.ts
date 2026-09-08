import { createApp } from './app.js';
import { configWarnings, env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectToDatabase, disconnectFromDatabase } from './db/connect.js';

async function start(): Promise<void> {
  for (const warning of configWarnings) logger.warn(warning);

  await connectToDatabase();

  const server = createApp().listen(env.PORT, () => {
    logger.info(`BookQuest API listening on http://localhost:${env.PORT}`);
  });

  // Finish in-flight requests before the process goes away.
  const shutdown = (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => {
      void disconnectFromDatabase().finally(() => process.exit(0));
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

start().catch((error: unknown) => {
  logger.error({ err: error }, 'Failed to start');
  process.exit(1);
});
