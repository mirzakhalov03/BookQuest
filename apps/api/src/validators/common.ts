import { z } from 'zod';
import { OBJECT_ID_PATTERN } from '../utils/mongo.js';

export const objectId = z.string().regex(OBJECT_ID_PATTERN, 'That is not a valid id.');
