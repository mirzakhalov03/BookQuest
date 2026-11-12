import { Router } from 'express';
import * as quizController from '../controllers/quiz.controllers.js';
import { requireUser } from '../middlewares/auth.middleware.js';
import { quizRateLimit } from '../middlewares/rate-limit.middleware.js';
import { validate } from '../middlewares/validate.middleware.js';
import { attemptItemParams, putAttemptItemBody } from '../validators/quiz.validators.js';

export const quizRoutes: Router = Router();

// Attempt state changes every second; no cache (browser, proxy, webview) may replay it.
quizRoutes.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  next();
});
quizRoutes.use(requireUser, quizRateLimit);

quizRoutes.get('/me', quizController.getOverview);
quizRoutes.post('/attempt', quizController.startAttempt);
quizRoutes.get('/attempt', quizController.getAttempt);
quizRoutes.get('/attempt/review', quizController.getReview);
quizRoutes.post('/attempt/next', quizController.next);
quizRoutes.put(
  '/attempt/items/:index',
  validate(attemptItemParams, 'params'),
  validate(putAttemptItemBody),
  quizController.putItem
);
