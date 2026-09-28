import type { Request, Response } from 'express';
import type {
  EmailLoginPayload,
  EmailRegisterPayload,
  TelegramAuthPayload,
  TelegramWidgetAuthPayload
} from '@bookquest/shared';
import * as authService from '../services/auth.services.js';
import { currentUser } from '../middlewares/auth.middleware.js';
import { ok } from '../utils/respond.js';

/** POST /api/v1/auth/telegram */
export async function signInWithTelegram(req: Request, res: Response): Promise<void> {
  const { initData } = req.body as TelegramAuthPayload;
  ok(res, await authService.authenticateWithTelegram(initData));
}

/** POST /api/v1/auth/telegram-widget */
export async function signInWithTelegramWidget(req: Request, res: Response): Promise<void> {
  ok(res, await authService.authenticateWithTelegramWidget(req.body as TelegramWidgetAuthPayload));
}

/** POST /api/v1/auth/register */
export async function registerWithEmail(req: Request, res: Response): Promise<void> {
  ok(res, await authService.registerWithEmail(req.body as EmailRegisterPayload));
}

/** POST /api/v1/auth/login */
export async function signInWithEmail(req: Request, res: Response): Promise<void> {
  ok(res, await authService.authenticateWithEmail(req.body as EmailLoginPayload));
}

/** POST /api/v1/auth/telegram/link */
export async function linkTelegramAccount(req: Request, res: Response): Promise<void> {
  ok(res, await authService.linkTelegram(currentUser(req), req.body as TelegramWidgetAuthPayload));
}

/** GET /api/v1/auth/me */
export async function getMe(req: Request, res: Response): Promise<void> {
  ok(res, await authService.toSessionUser(currentUser(req)));
}
