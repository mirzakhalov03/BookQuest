import { Router } from 'express';
import * as botController from '../controllers/bot.controllers.js';
import { validate } from '../middlewares/validate.middleware.js';
import { requireBotService } from '../middlewares/bot-service.middleware.js';
import { botInteractionsBody, botUserUpsertBody } from '../validators/bot.validators.js';

export const botRoutes: Router = Router();

botRoutes.post('/users', requireBotService, validate(botUserUpsertBody), botController.upsertUser);
// Its 256 kb body limit is mounted in app.ts, ahead of the global parser.
botRoutes.post(
  '/interactions',
  requireBotService,
  validate(botInteractionsBody),
  botController.recordInteractions
);
