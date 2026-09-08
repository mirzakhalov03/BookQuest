import { Router } from 'express';
import * as adminQuestController from '../../controllers/admin/quest.controllers.js';
import { validate } from '../../middlewares/validate.middleware.js';
import {
  createQuestBody,
  questIdParams,
  updateQuestBody
} from '../../validators/admin.validators.js';

export const adminQuestRoutes: Router = Router();

adminQuestRoutes.post('/', validate(createQuestBody), adminQuestController.createQuest);

adminQuestRoutes.patch(
  '/:id',
  validate(questIdParams, 'params'),
  validate(updateQuestBody),
  adminQuestController.updateQuest
);

adminQuestRoutes.post(
  '/:id/make-current',
  validate(questIdParams, 'params'),
  adminQuestController.makeQuestCurrent
);
