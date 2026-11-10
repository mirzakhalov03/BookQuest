import { createHash, timingSafeEqual } from 'node:crypto';

export const sha256 = (value: string): Buffer => createHash('sha256').update(value).digest();

/** Hashing both sides first gives equal lengths, so the compare leaks nothing about the length either. */
export function safeEqual(a: string, b: string): boolean {
  return timingSafeEqual(sha256(a), sha256(b));
}
