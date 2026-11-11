import type { Request, Response } from 'express';
import type { CreateQuizPayload, SaveQuizPayload } from '@bookquest/shared';
import * as quizService from '../../services/quiz.services.js';
import { currentUser } from '../../middlewares/auth.middleware.js';
import { auditAdmin } from '../../utils/audit.js';
import { ok } from '../../utils/respond.js';

/** GET /api/v1/admin/quizzes */
export async function listQuizzes(_req: Request, res: Response): Promise<void> {
  ok(res, await quizService.listQuizzes());
}

/** POST /api/v1/admin/quizzes */
export async function createQuiz(req: Request, res: Response): Promise<void> {
  const quiz = await quizService.createQuiz(req.body as CreateQuizPayload, currentUser(req));
  auditAdmin(req, 'create-quiz', { quizId: quiz.id });
  ok(res, quiz, 201);
}

/** GET /api/v1/admin/quizzes/:id */
export async function getQuiz(req: Request, res: Response): Promise<void> {
  ok(res, await quizService.getQuizAdmin((req.params as { id: string }).id));
}

/** PUT /api/v1/admin/quizzes/:id */
export async function saveQuiz(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const quiz = await quizService.saveQuiz(id, req.body as SaveQuizPayload);
  auditAdmin(req, 'save-quiz', { quizId: id, revision: quiz.revision, questions: quiz.questions.length });
  ok(res, quiz);
}

/** POST /api/v1/admin/quizzes/:id/duplicate */
export async function duplicateQuiz(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const quiz = await quizService.duplicateQuiz(id, currentUser(req));
  auditAdmin(req, 'duplicate-quiz', { quizId: id, copyId: quiz.id });
  ok(res, quiz, 201);
}

/** DELETE /api/v1/admin/quizzes/:id */
export async function deleteQuiz(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  await quizService.deleteQuiz(id);
  auditAdmin(req, 'delete-quiz', { quizId: id });
  ok(res, null);
}
