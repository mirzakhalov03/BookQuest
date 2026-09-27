import type { Request, Response } from 'express';
import * as notificationService from '../services/notification.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** GET /api/v1/me/notifications */
export async function listMine(req: Request, res: Response): Promise<void> {
  ok(res, await notificationService.listNotificationsFor(currentUser(req)));
}

/** POST /api/v1/me/notifications/:id/read */
export async function markRead(req: Request, res: Response): Promise<void> {
  ok(res, await notificationService.markNotificationRead(currentUser(req), req.params.id as string));
}
