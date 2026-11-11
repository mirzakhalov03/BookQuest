import { Schema, model, type InferSchemaType } from 'mongoose';
import { CERTIFICATE_DELIVERY_STATUSES } from '@bookquest/shared';

/** One row per quest: is a send running, and when. Per-person progress lives on Result. */
const certificateDeliverySchema = new Schema(
  {
    // Unique: it's what turns a second concurrent "Send" into a 409 (see startCertificateDelivery).
    quest: { type: Schema.Types.ObjectId, ref: 'Quest', required: true, unique: true },
    status: { type: String, enum: CERTIFICATE_DELIVERY_STATUSES, required: true },
    startedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    startedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null }
  },
  { timestamps: true }
);

export type CertificateDeliveryAttributes = InferSchemaType<typeof certificateDeliverySchema>;
export const CertificateDeliveryModel = model('CertificateDelivery', certificateDeliverySchema);
