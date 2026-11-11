import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { pinoHttp } from 'pino-http';
import { corsOrigins, env, isProduction } from './config/env.js';
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
  app.set('trust proxy', isProduction ? env.TRUST_PROXY_HOPS : false);

  app.use(helmet());
  app.use(cors({ origin: corsOrigins, credentials: true }));
  // Bigger bodies for the bot's batches only. Must run before the global parser, which would 413 them first.
  app.use('/api/v1/bot/interactions', express.json({ limit: '256kb' }));
  // A 100-question quiz exceeds the global 100kb.
  app.put(/^\/api\/v1\/admin\/quizzes\/[0-9a-f]{24}$/i, express.json({ limit: '512kb' }));
  app.use(express.json({ limit: '100kb' }));
  app.use(pinoHttp({ logger }));

  // Deliberately ahead of the rate limiter: a host's health check must never
  // be throttled into reporting the service as down.
  // 503 while Mongo is down, so the host stops routing to an instance that can't serve.
  app.get('/health', (_req, res) => {
    if (mongoose.connection.readyState !== mongoose.ConnectionStates.connected) {
      res.status(503).json({ ok: false, error: { code: 'unavailable', message: 'Database unreachable.' } });
      return;
    }
    res.json({ ok: true, data: { status: 'up', uptime: process.uptime() } });
  });

  app.use('/api/v1', globalRateLimit, apiRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
