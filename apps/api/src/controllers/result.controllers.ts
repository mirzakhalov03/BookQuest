import type { Request, Response } from 'express';
import * as resultService from '../services/result.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** GET /api/v1/quests/current/results */
export async function getCurrentResults(req: Request, res: Response): Promise<void> {
  // Varies by viewer, so no shared cache may hold it.
  res.setHeader('Cache-Control', 'private, no-cache');
  ok(res, await resultService.getCurrentQuestResults(req.currentUser ?? null));
}

/** GET /api/v1/participants/me/certificate */
export async function getMyCertificate(req: Request, res: Response): Promise<void> {
  ok(res, await resultService.getCertificateForUser(currentUser(req)));
}
