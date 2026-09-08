import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { BOOK_RESOURCE_KINDS } from '@bookquest/shared';

/** Where to actually get the book. Admin-editable, ordered as entered. */
const bookResourceSchema = new Schema(
  {
    label: { type: String, required: true, trim: true },
    url: { type: String, required: true, trim: true },
    kind: { type: String, enum: BOOK_RESOURCE_KINDS, required: true }
  },
  { _id: false }
);

const bookSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    author: { type: String, required: true, trim: true },
    pages: { type: Number, required: true, min: 1 },
    coverUrl: { type: String, default: null },
    description: { type: String, default: null },
    resources: { type: [bookResourceSchema], default: [] }
  },
  { _id: false }
);

/** Free text: "AirPods Pro", "500,000 so'm". A structure invented now would be wrong. */
const prizesSchema = new Schema(
  {
    first: { type: String, default: null },
    second: { type: String, default: null },
    third: { type: String, default: null }
  },
  { _id: false }
);

const questSchema = new Schema(
  {
    edition: { type: Number, required: true, unique: true },
    year: { type: Number, required: true },
    book: { type: bookSchema, required: true },
    prizes: { type: prizesSchema, default: () => ({}) },

    /* The phase is never stored. It is derived from these four dates, so the
       database can never disagree with the clock. */

    opensAt: { type: Date, required: true },
    readingDeadline: { type: Date, required: true },
    quizOpensAt: { type: Date, required: true },
    quizClosesAt: { type: Date, required: true },
    resultsAt: { type: Date, required: true },

    /** Shown as "20 questions in 30 minutes" before the quiz exists. */
    quizQuestionCount: { type: Number, default: null, min: 1 },
    quizDurationMinutes: { type: Number, default: null, min: 1 },

    /** Denormalised so the Home screen never has to count a whole collection. */
    participantCount: { type: Number, default: 0, min: 0 },

    /** Exactly one quest is the current one; the rest are archive. */
    isCurrent: { type: Boolean, default: false }
  },
  { timestamps: true }
);

/* Two current quests become impossible at the storage layer rather than by
   convention. A partial index constrains only the documents where it is true,
   so any number of past quests can carry isCurrent: false. */
questSchema.index(
  { isCurrent: 1 },
  { unique: true, partialFilterExpression: { isCurrent: true } }
);

// The archive, newest first.
questSchema.index({ year: -1 });

export type QuestAttributes = InferSchemaType<typeof questSchema>;
export type QuestDocument = HydratedDocument<QuestAttributes>;

export const QuestModel = model('Quest', questSchema);
