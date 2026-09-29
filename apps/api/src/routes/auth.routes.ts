import { Router } from 'express';
import * as authController from '../controllers/auth.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { authRateLimit } from '../middlewares/rate-limit.middleware.js';
import {
  telegramAuthBody,
  telegramWidgetAuthBody,
  phoneRegisterBody,
  phoneLoginBody,
  telegramCodeRequestBody,
  telegramCodeVerifyBody,
  updateProfileBody
} from '../validators/auth.validators.js';

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

authRoutes.post(
  '/register',
  authRateLimit,
  validate(phoneRegisterBody),
  authController.registerWithPhone
);

authRoutes.post('/login', authRateLimit, validate(phoneLoginBody), authController.signInWithPhone);

authRoutes.post(
  '/telegram-code/request',
  authRateLimit,
  validate(telegramCodeRequestBody),
  authController.requestTelegramCode
);

authRoutes.post(
  '/telegram-code/verify',
  authRateLimit,
  validate(telegramCodeVerifyBody),
  authController.verifyTelegramCode
);

authRoutes.post(
  '/telegram/link',
  requireUser,
  authRateLimit,
  validate(telegramWidgetAuthBody),
  authController.linkTelegramAccount
);

authRoutes.get('/me', requireUser, authController.getMe);
authRoutes.patch('/me', requireUser, validate(updateProfileBody), authController.updateMe);
