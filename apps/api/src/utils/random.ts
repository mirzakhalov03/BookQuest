import { randomBytes, randomInt } from 'node:crypto';

/** URL-safe random id; 10 chars of base64url is ~60 bits. */
export function randomId(length = 10): string {
  return randomBytes(Math.ceil((length * 3) / 4) + 1)
    .toString('base64url')
    .slice(0, length);
}

/** Unbiased Fisher–Yates with a CSPRNG; returns a copy. */
export function shuffle<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}
