import type { Request, Response } from 'express';
import type { CreateBroadcastPayload } from '@bookquest/shared';
import * as broadcastService from '../../services/broadcast.services.js';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { ok } from '../../utils/respond.js';

/** POST /api/v1/admin/broadcasts — 202: accepted, delivery continues in the background. */
export async function createBroadcast(req: Request, res: Response): Promise<void> {
  const { message } = req.body as CreateBroadcastPayload;
  const broadcast = await broadcastService.sendBroadcast(message, currentUser(req));
  ok(res, broadcast, 202);
}

/** GET /api/v1/admin/broadcasts */
export async function listBroadcasts(_req: Request, res: Response): Promise<void> {
  ok(res, await broadcastService.listBroadcasts());
}
