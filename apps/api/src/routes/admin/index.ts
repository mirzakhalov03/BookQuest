import { Router } from 'express';
import { requireAdmin, requireUser } from '../../middlewares/auth.middleware.js';
import { adminParticipantRoutes } from './participant.routes.js';
import { adminQuestRoutes } from './quest.routes.js';
import { adminStatsRoutes } from './stats.routes.js';

export const adminRoutes: Router = Router();

/* Authorization is applied here, at the mount, rather than route by route.
   A new admin endpoint is then protected by existing, not by remembering. */
adminRoutes.use(requireUser, requireAdmin);

adminRoutes.use('/participants', adminParticipantRoutes);
adminRoutes.use('/quests', adminQuestRoutes);
adminRoutes.use('/stats', adminStatsRoutes);
