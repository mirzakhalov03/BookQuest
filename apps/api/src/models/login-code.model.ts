import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/** One pending Telegram login code. Short-lived by design: the TTL index sweeps expired rows. */
const loginCodeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /* HMAC of the code, never the code itself. */
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    expiresAt: { type: Date, required: true }
  },
  // `createdAt` drives the resend cooldown.
  { timestamps: true }
);

// The sweep can lag about a minute, so reads still check `expiresAt` themselves.
loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginCodeAttributes = InferSchemaType<typeof loginCodeSchema>;
export type LoginCodeDocument = HydratedDocument<LoginCodeAttributes>;
export const LoginCodeModel = model('LoginCode', loginCodeSchema);
