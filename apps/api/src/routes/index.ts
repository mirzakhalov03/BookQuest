import { Router } from 'express';
import { authRoutes } from './auth.routes.js';
import { questRoutes } from './quest.routes.js';
import { participantRoutes } from './participant.routes.js';
import { adminRoutes } from './admin/index.js';
import { botRoutes } from './bot.routes.js';

/**
 * The API is versioned at the router, not per route, so a future v2 is a new
 * mount rather than a rewrite.
 */
export const apiRoutes: Router = Router();

apiRoutes.use('/auth', authRoutes);
apiRoutes.use('/quests', questRoutes);
apiRoutes.use('/participants', participantRoutes);
apiRoutes.use('/admin', adminRoutes);
apiRoutes.use('/bot', botRoutes);

// Coming later: /quiz
