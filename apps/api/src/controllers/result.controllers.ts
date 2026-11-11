import type { Request, Response } from 'express';
import * as resultService from '../services/result.services.js';
import * as certificateService from '../services/certificate.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** GET /api/v1/quests/current/results */
export async function getCurrentResults(req: Request, res: Response): Promise<void> {
  const viewer = req.currentUser ?? null;
  const results = await resultService.getCurrentQuestResults(viewer);
  // Set after success, so a "not published yet" 404 is never cached. Signed-in viewers get the full board, so theirs stays private.
  res.setHeader('Cache-Control', `${viewer ? 'private' : 'public'}, max-age=60`);
  res.setHeader('Vary', 'Authorization');
  ok(res, results);
}

/** GET /api/v1/participants/me/certificate */
export async function getMyCertificate(req: Request, res: Response): Promise<void> {
  ok(res, await certificateService.getCertificateForUser(currentUser(req)));
}
