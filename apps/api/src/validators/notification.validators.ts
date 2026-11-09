import { z } from 'zod';
import { objectId } from './common.js';

export const notificationIdParams = z.object({ id: objectId });
