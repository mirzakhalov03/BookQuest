import { Router } from 'express';
import * as authController from '../controllers/auth.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/rate-limit.middleware.js';
import { telegramAuthBody } from '../validators/auth.validators.js';

export const authRoutes: Router = Router();

// Unauthenticated by definition — this is where a session comes from — so the
// rate limit is the only thing standing in front of it.
authRoutes.post(
  '/telegram',
  authRateLimit,
  validate(telegramAuthBody),
  authController.signInWithTelegram
);

authRoutes.get('/me', requireUser, authController.getMe);
