import { Router } from 'express';
import * as questController from '../controllers/quest.controllers.js';
import * as resultController from '../controllers/result.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { questArchiveQuery, questEditionParams } from '../validators/quest.validators.js';

export const questRoutes: Router = Router();

// Quest content is public: the Home screen must render before anyone signs in.
questRoutes.get('/current', questController.getCurrentQuest);
questRoutes.get('/current/results', resultController.getCurrentResults);

questRoutes.get('/', validate(questArchiveQuery, 'query'), questController.listQuests);

// Last, so it cannot swallow /current.
questRoutes.get(
  '/:edition',
  validate(questEditionParams, 'params'),
  questController.getQuestByEdition
);
