import type { Request, Response } from 'express';
import * as resultService from '../services/result.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** GET /api/v1/quests/current/results */
export async function getCurrentResults(_req: Request, res: Response): Promise<void> {
  ok(res, await resultService.getCurrentQuestResults());
}

/** GET /api/v1/participants/me/certificate */
export async function getMyCertificate(req: Request, res: Response): Promise<void> {
  ok(res, await resultService.getCertificateForUser(currentUser(req)));
}
