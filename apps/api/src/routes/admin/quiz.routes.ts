import { Router } from 'express';
import * as adminQuizController from '../../controllers/admin/quiz.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  attemptsQuery,
  correctionBody,
  createQuizBody,
  groupSizesQuery,
  quizIdParams,
  saveQuizBody,
  voidAttemptBody
} from '../../validators/quiz.validators.js';

export const adminQuizRoutes: Router = Router();

adminQuizRoutes.get('/', adminQuizController.listQuizzes);
adminQuizRoutes.post('/', validate(createQuizBody), adminQuizController.createQuiz);
adminQuizRoutes.get('/:id', validate(quizIdParams, 'params'), adminQuizController.getQuiz);
adminQuizRoutes.put('/:id', validate(quizIdParams, 'params'), validate(saveQuizBody), adminQuizController.saveQuiz);
adminQuizRoutes.post('/:id/duplicate', validate(quizIdParams, 'params'), adminQuizController.duplicateQuiz);
adminQuizRoutes.post(
  '/:id/corrections',
  validate(quizIdParams, 'params'),
  validate(correctionBody),
  adminQuizController.applyCorrection
);
adminQuizRoutes.delete('/:id', validate(quizIdParams, 'params'), adminQuizController.deleteQuiz);

/** Mounted at `/admin/quiz`: operations on the current quest's quiz, not the library. */
export const adminQuizOpsRoutes: Router = Router();

adminQuizOpsRoutes.get('/group-sizes', validate(groupSizesQuery, 'query'), adminQuizController.groupSizes);
adminQuizOpsRoutes.get('/live', adminQuizController.liveStats);
adminQuizOpsRoutes.get('/standings', adminQuizController.standings);
adminQuizOpsRoutes.get('/attempts', validate(attemptsQuery, 'query'), adminQuizController.listAttempts);
adminQuizOpsRoutes.get('/attempts/:id', validate(quizIdParams, 'params'), adminQuizController.getAttempt);
adminQuizOpsRoutes.post('/attempts/:id/sheet', validate(quizIdParams, 'params'), adminQuizController.sendAnswerSheet);
adminQuizOpsRoutes.post(
  '/attempts/:id/void',
  validate(quizIdParams, 'params'),
  validate(voidAttemptBody),
  adminQuizController.voidAttempt
);
