import {
  QUESTION_DIFFICULTIES,
  QUESTION_TYPES,
  QUIZ_TIME_LIMIT_SEC
} from '@bookquest/shared';
import { Schema, model, type InferSchemaType, type HydratedDocument, type Types } from 'mongoose';

const optionSchema = new Schema(
  {
    id: { type: String, required: true },
    text: { type: String, default: '' }
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    id: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    prompt: { type: String, default: '' },
    options: { type: [optionSchema], default: [] },
    correctOptionId: { type: String, default: null },
    // null = settings.defaultTimeLimitSec
    timeLimitSec: { type: Number, default: null },
    difficulty: { type: String, enum: QUESTION_DIFFICULTIES, default: 'medium' },
    explanation: { type: String, default: null }
  },
  { _id: false }
);

const correctionSchema = new Schema(
  {
    questionId: { type: String, required: true },
    kind: { type: String, enum: ['key', 'void'], required: true },
    from: { type: String, default: null },
    to: { type: String, default: null },
    note: { type: String, default: null },
    by: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    at: { type: Date, required: true }
  },
  { _id: false }
);

const quizSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: null },
    settings: {
      type: new Schema(
        {
          shuffleQuestions: { type: Boolean, default: true },
          shuffleOptions: { type: Boolean, default: true },
          defaultTimeLimitSec: { type: Number, default: QUIZ_TIME_LIMIT_SEC.default }
        },
        { _id: false }
      ),
      default: () => ({})
    },
    questions: { type: [questionSchema], default: [] },
    // Optimistic concurrency: +1 per save.
    revision: { type: Number, default: 0 },
    corrections: { type: [correctionSchema], default: [] },
    voidedQuestionIds: { type: [String], default: [] },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

export type QuizAttributes = InferSchemaType<typeof quizSchema>;
export type QuizDocument = HydratedDocument<QuizAttributes>;
export type QuizRow = QuizAttributes & { _id: Types.ObjectId; updatedAt: Date };
export const QuizModel = model('Quiz', quizSchema);
