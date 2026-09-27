import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } }
});
