import type { ErrorRequestHandler, RequestHandler } from 'express';
import mongoose from 'mongoose';
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
export const errorHandler: ErrorRequestHandler = (rawError, _req, res, _next) => {
  const error = toClientError(rawError) ?? rawError;

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

/** The caller's mistakes that arrive as library errors: bad JSON, an oversized body, an invalid id or value. */
function toClientError(error: unknown): ApiError | null {
  if (error instanceof mongoose.Error.ValidationError || error instanceof mongoose.Error.CastError) {
    return ApiError.badRequest('Please check the details you entered.');
  }

  // body-parser marks its own errors `expose` with a 4xx `status`.
  const { status, expose } = (error ?? {}) as { status?: unknown; expose?: unknown };
  if (expose !== true || typeof status !== 'number' || status < 400 || status >= 500) return null;

  if (status === 413) return new ApiError(413, 'payload_too_large', 'That request is too large.');
  return ApiError.badRequest('That request could not be read.');
}
