import { z } from 'zod';
import { createQuizSchema, saveQuizSchema } from '@bookquest/shared';
import { objectId } from './common.js';

export const quizIdParams = z.object({ id: objectId });
export const createQuizBody = createQuizSchema;
export const saveQuizBody = saveQuizSchema;
