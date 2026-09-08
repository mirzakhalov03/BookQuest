import type { Request, Response } from 'express';
import type { TelegramAuthPayload } from '@bookquest/shared';
import * as authService from '../services/auth.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/auth/telegram */
export async function signInWithTelegram(req: Request, res: Response): Promise<void> {
  const { initData } = req.body as TelegramAuthPayload;
  ok(res, await authService.authenticateWithTelegram(initData));
}

/** GET /api/v1/auth/me */
export async function getMe(req: Request, res: Response): Promise<void> {
  ok(res, await authService.toSessionUser(currentUser(req)));
}
