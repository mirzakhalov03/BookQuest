import type { Request, Response } from 'express';
import type { PutAttemptItemPayload } from '@bookquest/shared';
import * as attemptService from '../services/quiz-attempt.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';
import type { AttemptItemParams } from '../validators/quiz.validators.js';

/** GET /api/v1/quiz/me */
export async function getOverview(req: Request, res: Response): Promise<void> {
  ok(res, await attemptService.getOverview(currentUser(req)));
}

/** POST /api/v1/quiz/attempt — 201 when this call created it. */
export async function startAttempt(req: Request, res: Response): Promise<void> {
  const { state, created } = await attemptService.startAttempt(currentUser(req));
  ok(res, state, created ? 201 : 200);
}

/** GET /api/v1/quiz/attempt */
export async function getAttempt(req: Request, res: Response): Promise<void> {
  ok(res, await attemptService.getAttemptState(currentUser(req)));
}

/** POST /api/v1/quiz/attempt/next */
export async function next(req: Request, res: Response): Promise<void> {
  ok(res, await attemptService.serveNext(currentUser(req), req.receivedAt));
}

/** PUT /api/v1/quiz/attempt/items/:index */
export async function putItem(req: Request, res: Response): Promise<void> {
  const { index } = req.params as unknown as AttemptItemParams;
  ok(res, await attemptService.putItem(currentUser(req), index, req.body as PutAttemptItemPayload, req.receivedAt));
}

/** GET /api/v1/quiz/attempt/review */
export async function getReview(req: Request, res: Response): Promise<void> {
  ok(res, await attemptService.getReview(currentUser(req)));
}
