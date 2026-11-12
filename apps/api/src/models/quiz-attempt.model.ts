import { ATTEMPT_STATUSES, ITEM_OUTCOMES, QUESTION_DIFFICULTIES, QUESTION_TYPES } from '@bookquest/shared';
import { Schema, model, type InferSchemaType, type HydratedDocument, type Types } from 'mongoose';

const optionSchema = new Schema({ id: { type: String, required: true }, text: { type: String, default: '' } }, { _id: false });

/* Every nullable field defaults to null: positional `$type: 'null'` filters
   (IS_NULL in quiz-scoring) need a real stored null, never a missing field. */
const itemSchema = new Schema(
  {
    questionId: { type: String, required: true },
    type: { type: String, enum: QUESTION_TYPES, required: true },
    prompt: { type: String, default: '' },
    explanation: { type: String, default: null },
    // In the order this participant sees them.
    options: { type: [optionSchema], default: [] },
    // Copied at start; changed only by an answer-key correction.
    correctOptionId: { type: String, required: true },
    voided: { type: Boolean, default: false },
    difficulty: { type: String, enum: QUESTION_DIFFICULTIES, default: 'medium' },
    timeLimitMs: { type: Number, required: true },
    servedAt: { type: Date, default: null },
    deadlineAt: { type: Date, default: null },
    selectedOptionId: { type: String, default: null },
    selectedAt: { type: Date, default: null },
    lockedAt: { type: Date, default: null },
    // null = unresolved
    outcome: { type: String, enum: [...ITEM_OUTCOMES, null], default: null },
    isCorrect: { type: Boolean, default: null },
    elapsedMs: { type: Number, default: null },
    // Phone-measured on-screen time for a lock; counted only within the latency refund window.
    clientElapsedMs: { type: Number, default: null },
    // Client-reported, advisory only.
    signals: {
      type: new Schema(
        { hiddenCount: { type: Number, default: 0 }, hiddenMs: { type: Number, default: 0 } },
        { _id: false }
      ),
      default: () => ({})
    }
  },
  { _id: false }
);

const quizAttemptSchema = new Schema(
  {
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true },
    participant: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    quiz: { type: Schema.Types.ObjectId, ref: 'Quiz', required: true },
    quizRevision: { type: Number, required: true },
    // Index into quest.quizConfig.quizzes; frozen at start.
    group: { type: Number, required: true },
    status: { type: String, enum: ATTEMPT_STATUSES, default: 'in_progress' },
    // First unresolved item; equals items.length when done.
    cursor: { type: Number, default: 0 },
    items: { type: [itemSchema], default: [] },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    finalizedBy: { type: String, enum: ['participant', 'sweep', 'ranking', null], default: null },
    score: { type: Number, default: null },
    total: { type: Number, default: null },
    durationMs: { type: Number, default: null },
    // Repair marker: Result written for this attempt.
    resultWrittenAt: { type: Date, default: null },
    clientIds: { type: [String], default: [] },
    flags: { type: [String], default: [] },
    voidReason: { type: String, default: null },
    voidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    voidedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

// One attempt per person per quest: the guarantee behind the start race.
quizAttemptSchema.index({ quest: 1, participant: 1 }, { unique: true, name: 'quest_participant_unique' });
quizAttemptSchema.index({ quest: 1, status: 1 }, { name: 'quest_status' });
// Play requests read the attempt by user, in parallel with the participant lookup.
quizAttemptSchema.index({ quest: 1, user: 1 }, { name: 'quest_user' });
quizAttemptSchema.index({ quiz: 1, status: 1 }, { name: 'quiz_status' });

export type AttemptAttributes = InferSchemaType<typeof quizAttemptSchema>;
export type AttemptItemRow = AttemptAttributes['items'][number];
export type AttemptRow = AttemptAttributes & { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };
export type QuizAttemptDocument = HydratedDocument<AttemptAttributes>;
export const QuizAttemptModel = model('QuizAttempt', quizAttemptSchema);
