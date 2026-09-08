import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One person's finished quiz. Written by the quiz (not yet built); read by the
 * leaderboard and the certificate.
 */
const resultSchema = new Schema(
  {
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true },
    participant: { type: Schema.Types.ObjectId, ref: 'Participant', required: true },

    score: { type: Number, required: true, min: 0 },
    /* Stored per result, not read from the quest: if next year asks 25
       questions, an old "18 correct" must still mean 18 out of 20. */
    total: { type: Number, required: true, min: 0 },
    /** Tiebreaker — two people with the same score are separated by speed. */
    durationMs: { type: Number, required: true, min: 0 },

    /* Computed once when results are published and then frozen. A rank that
       shifts between two page loads is a bug people notice immediately. */
    rank: { type: Number, default: null, min: 1 },

    /** Short public verification code, assigned at publication. */
    certificateCode: { type: String, default: null },

    submittedAt: { type: Date, required: true }
  },
  { timestamps: true }
);

// One result per person per quest.
resultSchema.index({ quest: 1, participant: 1 }, { unique: true });

// The leaderboard sort, served entirely from the index.
resultSchema.index({ quest: 1, score: -1, durationMs: 1 });

/* Partial, not sparse. A sparse index skips documents where the field is
   absent — but an unpublished result stores an explicit null, and every one of
   those nulls would collide. Indexing only the documents where a code actually
   exists is what was meant. */
resultSchema.index(
  { certificateCode: 1 },
  { unique: true, partialFilterExpression: { certificateCode: { $type: 'string' } } }
);

export type ResultAttributes = InferSchemaType<typeof resultSchema>;
export type ResultDocument = HydratedDocument<ResultAttributes>;

export const ResultModel = model('Result', resultSchema);
