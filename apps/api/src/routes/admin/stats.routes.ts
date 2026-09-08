import { Router } from 'express';
import * as adminStatsController from '../../controllers/admin/stats.controllers.js';

export const adminStatsRoutes: Router = Router();

adminStatsRoutes.get('/', adminStatsController.getStats);
