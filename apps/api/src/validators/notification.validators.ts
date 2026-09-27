import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-f]{24}$/i, 'That is not a valid id.');

export const notificationIdParams = z.object({ id: objectId });
