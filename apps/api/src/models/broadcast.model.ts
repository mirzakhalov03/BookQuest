import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * A sent-history record for admin's own list. Participants never read this
 * directly — they read the `Notification` rows it fanned out into.
 */
const broadcastSchema = new Schema(
  {
    message: { type: String, required: true, trim: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    recipientCount: { type: Number, required: true, min: 0 }
  },
  { timestamps: true }
);

broadcastSchema.index({ createdAt: -1 });

export type BroadcastAttributes = InferSchemaType<typeof broadcastSchema>;
export type BroadcastDocument = HydratedDocument<BroadcastAttributes>;
export const BroadcastModel = model('Broadcast', broadcastSchema);
