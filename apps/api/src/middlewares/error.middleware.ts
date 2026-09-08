import type { ErrorRequestHandler, RequestHandler } from 'express';
import type { ApiFailure } from '@bookquest/shared';
import { ApiError } from '../utils/api-error.js';
import { isDuplicateKeyError } from '../utils/mongo.js';
import { logger } from '../config/logger.js';
import { isProduction } from '../config/env.js';

export const notFoundHandler: RequestHandler = (req, res) => {
  const body: ApiFailure = {
    ok: false,
    error: { code: 'not_found', message: `No route for ${req.method} ${req.originalUrl}` }
  };
  res.status(404).json(body);
};

/**
 * The single exit for every failure. Express 5 forwards rejected promises here
 * automatically, so route handlers can stay plain async functions.
 */
export const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  if (error instanceof ApiError) {
    const body: ApiFailure = {
      ok: false,
      error: {
        code: error.code,
        message: error.message,
        ...(error.fields ? { fields: error.fields } : {})
      }
    };
    res.status(error.status).json(body);
    return;
  }

  /* A unique index doing its job is not a server fault. Services translate the
     collisions they expect into a specific message; this is the net that keeps
     the rest from escaping as a 500. */
  if (isDuplicateKeyError(error)) {
    const body: ApiFailure = {
      ok: false,
      error: { code: 'conflict', message: 'That already exists.' }
    };
    res.status(409).json(body);
    return;
  }

  logger.error({ err: error }, 'Unhandled error');

  const body: ApiFailure = {
    ok: false,
    error: {
      code: 'internal_error',
      message: isProduction
        ? 'Something went wrong on our side.'
        : error instanceof Error
          ? error.message
          : 'Unknown error'
    }
  };
  res.status(500).json(body);
};
