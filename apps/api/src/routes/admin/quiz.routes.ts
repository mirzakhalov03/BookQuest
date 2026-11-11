import { Router } from 'express';
import * as adminQuizController from '../../controllers/admin/quiz.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import { createQuizBody, quizIdParams, saveQuizBody } from '../../validators/quiz.validators.js';

export const adminQuizRoutes: Router = Router();

adminQuizRoutes.get('/', adminQuizController.listQuizzes);
adminQuizRoutes.post('/', validate(createQuizBody), adminQuizController.createQuiz);
adminQuizRoutes.get('/:id', validate(quizIdParams, 'params'), adminQuizController.getQuiz);
adminQuizRoutes.put('/:id', validate(quizIdParams, 'params'), validate(saveQuizBody), adminQuizController.saveQuiz);
adminQuizRoutes.post('/:id/duplicate', validate(quizIdParams, 'params'), adminQuizController.duplicateQuiz);
adminQuizRoutes.delete('/:id', validate(quizIdParams, 'params'), adminQuizController.deleteQuiz);
