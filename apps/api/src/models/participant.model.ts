import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';
import { CONTACT_METHODS, PARTICIPANT_NUMBER_MAX, PARTICIPANT_NUMBER_MIN } from '@bookquest/shared';

/**
 * How we reach this person. A subdocument rather than inline fields, so the
 * inferred type is a required object instead of a bag of optional keys.
 */
const contactSchema = new Schema(
  {
    method: { type: String, enum: CONTACT_METHODS, required: true },
    value: { type: String, required: true, trim: true }
  },
  { _id: false }
);

const participantSchema = new Schema(
  {
    /** The four-digit number the participant knows themselves by. Permanent. */
    number: {
      type: Number,
      required: true,
      min: PARTICIPANT_NUMBER_MIN,
      max: PARTICIPANT_NUMBER_MAX
    },
    fullName: { type: String, required: true, trim: true },
    contact: { type: contactSchema, required: true },
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true },

    /** Identity. Replaces the loose telegramUserId string this used to carry. */
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true }
  },
  { timestamps: true }
);

// Numbers are unique within a quest, not across all time — next year restarts.
participantSchema.index({ quest: 1, number: 1 }, { unique: true });

// The real rule: one registration per person per quest.
participantSchema.index({ quest: 1, user: 1 }, { unique: true });

/* Deliberately NOT unique. Contact is reachability, not identity — a unique
   index here wrongly blocks two family members sharing a phone number. */
participantSchema.index({ quest: 1, 'contact.value': 1 });

// Admin search by name.
participantSchema.index({ quest: 1, fullName: 1 });

export type ParticipantAttributes = InferSchemaType<typeof participantSchema>;
export type ParticipantDocument = HydratedDocument<ParticipantAttributes>;

export const ParticipantModel = model('Participant', participantSchema);
