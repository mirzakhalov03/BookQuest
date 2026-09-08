import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { corsOrigins, isProduction } from './config/env.js';
import { logger } from './config/logger.js';
import { apiRoutes } from './routes/index.js';
import { globalRateLimit } from './middlewares/rate-limit.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');
  /* Behind a host's TLS terminator, req.ip is the proxy unless we say so — and
     an IP-keyed rate limit that sees one address for everyone is useless. Off
     in development, where there is no proxy to trust. */
  app.set('trust proxy', isProduction ? 1 : false);

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));

  // Deliberately ahead of the rate limiter: a host's health check must never
  // be throttled into reporting the service as down.
  app.get('/health', (_req, res) => {
    res.json({ ok: true, data: { status: 'up', uptime: process.uptime() } });
  });

  app.use('/api/v1', globalRateLimit, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
