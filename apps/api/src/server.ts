import { createApp } from './app.js';
import { configWarnings, env } from './config/env.js';
import { logger } from './config/logger.js';
import { connectToDatabase, disconnectFromDatabase } from './db/connect.js';
import { markInterruptedBroadcasts } from './services/broadcast.services.js';
import { markInterruptedCertificateDeliveries } from './services/certificate-delivery.services.js';
import { sweepOrphanCovers } from './services/cover.services.js';

const SWEEP_EVERY_MS = 6 * 60 * 60 * 1000;

function sweepCovers(): void {
  sweepOrphanCovers()
    .then((removed) => removed > 0 && logger.info({ removed }, 'Removed abandoned cover uploads'))
    .catch((error: unknown) => logger.warn({ err: error }, 'Cover sweep failed'));
}

async function start(): Promise<void> {
  for (const warning of configWarnings) logger.warn(warning);

  await connectToDatabase();
  const interrupted = await markInterruptedBroadcasts();
  if (interrupted > 0) logger.warn({ interrupted }, 'Marked broadcasts left mid-send by the last shutdown as interrupted');
  const interruptedCertificates = await markInterruptedCertificateDeliveries();
  if (interruptedCertificates > 0) {
    logger.warn('Marked a certificate delivery left mid-send as interrupted — press Send again to finish it');
  }

  sweepCovers();
  // unref: the timer must not keep a shutting-down process alive.
  setInterval(sweepCovers, SWEEP_EVERY_MS).unref();

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
