import { SignJWT, jwtVerify } from 'jose';
import { env } from '../config/env.js';

const key = new TextEncoder().encode(env.JWT_SECRET);
const ALGORITHM = 'HS256';

export interface IssuedToken {
  token: string;
  expiresAt: Date;
}

/**
 * The token carries the user id and nothing else — no role, no name.
 *
 * A role baked into a token stays true for as long as the token lives, so
 * revoking an admin would take a week to take effect. Every authorization
 * decision re-reads the user instead; the token only answers "who".
 */
export async function signSessionToken(userId: string): Promise<IssuedToken> {
  const expiresAt = new Date(Date.now() + env.JWT_EXPIRES_IN_DAYS * 24 * 60 * 60 * 1000);

  const token = await new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(key);

  return { token, expiresAt };
}

/** Returns the user id, or null for anything invalid, expired or malformed. */
export async function readSessionToken(token: string): Promise<string | null> {
  try {
    const { payload } = await jwtVerify(token, key, { algorithms: [ALGORITHM] });
    return payload.sub ?? null;
  } catch {
    return null;
  }
}

/** `Authorization: Bearer <token>` → token, or null. */
export function readBearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (!value || scheme?.toLowerCase() !== 'bearer') return null;
  return value.trim() || null;
}
