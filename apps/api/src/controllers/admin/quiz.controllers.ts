import type { Request, Response } from 'express';
import type { CreateQuizPayload, SaveQuizPayload, VoidAttemptPayload } from '@bookquest/shared';
import * as quizService from '../../services/quiz.services.js';
import * as quizConfigService from '../../services/quiz-config.services.js';
import * as quizOpsService from '../../services/quiz-ops.services.js';
import * as resultService from '../../services/result.services.js';
import * as questService from '../../services/quest.services.js';
import type { AttemptsQuery, GroupSizesQuery } from '../../validators/quiz.validators.js';
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

/** GET /api/v1/admin/quiz/live */
export async function liveStats(_req: Request, res: Response): Promise<void> {
  ok(res, await quizOpsService.getLiveStats());
}

/** GET /api/v1/admin/quiz/attempts */
export async function listAttempts(req: Request, res: Response): Promise<void> {
  ok(res, await quizOpsService.listAttempts(req.query as unknown as AttemptsQuery));
}

/** GET /api/v1/admin/quiz/attempts/:id */
export async function getAttempt(req: Request, res: Response): Promise<void> {
  ok(res, await quizOpsService.getAttemptAdmin((req.params as { id: string }).id));
}

/** POST /api/v1/admin/quiz/attempts/:id/void */
export async function voidAttempt(req: Request, res: Response): Promise<void> {
  const { id } = req.params as { id: string };
  const { reason } = req.body as VoidAttemptPayload;
  const attempt = await quizOpsService.voidAttempt(id, reason, currentUser(req));
  // The leaderboard cache would still rank the deleted Result.
  resultService.clearResultsCache();
  auditAdmin(req, 'void-quiz-attempt', { attemptId: id });
  ok(res, attempt);
}
