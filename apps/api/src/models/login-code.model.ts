import { Schema, model, type InferSchemaType, type HydratedDocument } from 'mongoose';

/**
 * One Telegram login code. Rows outlive the code itself: they're the per-user
 * history the send and failed-guess budgets count over, so exhausting or
 * using a code never resets those budgets.
 */
const loginCodeSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    /* HMAC of the code, never the code itself. */
    codeHash: { type: String, required: true },
    attempts: { type: Number, default: 0 },
    /** When the code stops working (10 min). */
    validUntil: { type: Date, required: true },
    /** Set once, on the successful guess — the single-use guard. */
    consumedAt: { type: Date, default: null },
    /** Keys the resend cooldown, so someone else's requests can't hold yours off. */
    requestIp: { type: String, default: null },
    /** When the TTL index purges the row (24h) — the longest budget window. */
    expiresAt: { type: Date, required: true }
  },
  { timestamps: true }
);

loginCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginCodeAttributes = InferSchemaType<typeof loginCodeSchema>;
export type LoginCodeDocument = HydratedDocument<LoginCodeAttributes>;
export const LoginCodeModel = model('LoginCode', loginCodeSchema);
