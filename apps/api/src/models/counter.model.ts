import { Schema, model } from 'mongoose';

/**
 * Sequence allocator. Participant numbers are handed out with a single atomic
 * $inc rather than "read the highest and add one", which would hand two people
 * the same number under concurrent registration.
 */
const counterSchema = new Schema({
  _id: { type: String, required: true },
  value: { type: Number, required: true, default: 0 }
});

export const CounterModel = model('Counter', counterSchema);

export async function nextSequence(key: string, startAt: number): Promise<number> {
  const counter = await CounterModel.findByIdAndUpdate(
    key,
    { $inc: { value: 1 } },
    { returnDocument: 'after', upsert: true }
  ).lean();

  return startAt + (counter?.value ?? 1) - 1;
}
