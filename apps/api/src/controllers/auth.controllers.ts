import type { Request, Response } from 'express';
import type {
  PhoneLoginPayload,
  PhoneRegisterPayload,
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
export async function registerWithPhone(req: Request, res: Response): Promise<void> {
  ok(res, await authService.registerWithPhone(req.body as PhoneRegisterPayload));
}

/** POST /api/v1/auth/login */
export async function signInWithPhone(req: Request, res: Response): Promise<void> {
  ok(res, await authService.authenticateWithPhone(req.body as PhoneLoginPayload));
}

/** POST /api/v1/auth/telegram/link */
export async function linkTelegramAccount(req: Request, res: Response): Promise<void> {
  ok(res, await authService.linkTelegram(currentUser(req), req.body as TelegramWidgetAuthPayload));
}

/** GET /api/v1/auth/me */
export async function getMe(req: Request, res: Response): Promise<void> {
  ok(res, await authService.toSessionUser(currentUser(req)));
}
