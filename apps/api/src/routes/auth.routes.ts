import { Router } from 'express';
import * as authController from '../controllers/auth.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/rate-limit.middleware.js';
import { telegramAuthBody, telegramWidgetAuthBody } from '../validators/auth.validators.js';

export const authRoutes: Router = Router();

// Unauthenticated by definition — this is where a session comes from — so the
// rate limit is the only thing standing in front of it.
authRoutes.post(
  '/telegram',
  authRateLimit,
  validate(telegramAuthBody),
  authController.signInWithTelegram
);

authRoutes.post(
  '/telegram-widget',
  authRateLimit,
  validate(telegramWidgetAuthBody),
  authController.signInWithTelegramWidget
);

authRoutes.get('/me', requireUser, authController.getMe);
