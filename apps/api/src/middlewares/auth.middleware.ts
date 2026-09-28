import type { Request, RequestHandler } from 'express';
import { UserModel, type UserDocument } from '../models/user.model.js';
import { readBearerToken, readSessionToken } from '../utils/token.js';
import { ApiError } from '../utils/api-error.js';

/**
 * Resolves the caller from the Authorization header, if there is one.
 *
 * The token answers "who" and nothing else — the user, including their role, is
 * always loaded from the database. That is what makes revoking an admin take
 * effect on the next request instead of when their token happens to expire.
 */
async function resolveUser(req: Request): Promise<UserDocument | null> {
  const token = readBearerToken(req.headers.authorization);
  if (!token) return null;

  const userId = await readSessionToken(token);
  if (!userId) return null;

  return UserModel.findById(userId);
}

/** Attaches the caller when a valid session exists; never rejects. */
export const optionalUser: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req);
  if (user) req.currentUser = user;
  next();
};

export const requireUser: RequestHandler = async (req, _res, next) => {
  const user = await resolveUser(req);
  if (!user) {
    next(ApiError.unauthorized('Sign in to continue.'));
    return;
  }
  req.currentUser = user;
  next();
};

/**
 * Mounted on the /admin router rather than on individual routes, so a new admin
 * endpoint cannot be added unprotected by accident. Assumes requireUser ran
 * first: 401 means "no session", 403 means "this session, but not allowed" —
 * and the client should not retry authentication for the second one.
 */
export const requireAdmin: RequestHandler = (req, _res, next) => {
  const user = req.currentUser;
  if (!user) {
    next(ApiError.unauthorized('Sign in to continue.'));
    return;
  }
  if (user.role !== 'admin') {
    next(ApiError.forbidden('This area is for organisers.'));
    return;
  }
  next();
};

/** For controllers and services that run behind requireUser. */
export function currentUser(req: Request): UserDocument {
  const user = req.currentUser;
  if (!user) throw ApiError.unauthorized('Sign in to continue.');
  return user;
}
