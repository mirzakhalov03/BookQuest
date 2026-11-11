import type { Request, Response } from 'express';
import type { CreateQuizPayload, SaveQuizPayload } from '@bookquest/shared';
import * as quizService from '../../services/quiz.services.js';
import * as quizConfigService from '../../services/quiz-config.services.js';
import * as questService from '../../services/quest.services.js';
import type { GroupSizesQuery } from '../../validators/quiz.validators.js';
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

/** GET /api/v1/admin/quiz/group-sizes — the live split the quest editor previews. */
export async function groupSizes(req: Request, res: Response): Promise<void> {
  const { distribution, groups } = req.query as unknown as GroupSizesQuery;
  const quest = await questService.requireCurrentQuestDocument();
  ok(res, { sizes: await quizConfigService.groupSizes(quest, distribution, groups) });
}
