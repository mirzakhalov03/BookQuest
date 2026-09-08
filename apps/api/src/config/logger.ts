import pino from 'pino';
import { env, isProduction } from './env.js';

export const logger = pino({
  level: env.LOG_LEVEL,
  /* Anything here would otherwise end up in a log aggregator forever: a valid
     initData string is a usable credential until it expires, a bearer token is
     a session, and a contact value is personal data we promised to hold, not
     to broadcast. */
  redact: {
    paths: [
      'req.headers.authorization',
      'req.body.initData',
      'req.body.contactValue',
      'initData',
      'token',
      'contact.value',
      '*.contact.value'
    ],
    censor: '[redacted]'
  },
  // Structured JSON in production; readable lines while developing.
  transport: isProduction ? undefined : { target: 'pino-pretty', options: { colorize: true } }
});
