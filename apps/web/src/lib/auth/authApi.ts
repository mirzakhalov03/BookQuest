import type { Session, SessionUser } from '@bookquest/shared';
import { api } from '@/lib/api/client';
import { getInitData } from '@/lib/telegram';
import { storeToken } from './tokenStore';

/**
 * The two auth endpoints, with no React in sight. The boot sequence, the hook
 * and the client's 401 retry all need them, and only one of those three is a
 * component.
 */

export const fetchMe = (): Promise<SessionUser> => api.get<SessionUser>('/auth/me');

/**
 * The only place a session is created. Resolves to null outside Telegram,
 * where there is no `initData` to exchange — that is read-only mode, not a
 * failure. A rejected exchange throws, because the caller decides what a
 * refused sign-in means.
 */
export async function loginWithTelegram(): Promise<Session | null> {
  const initData = getInitData();
  if (!initData) return null;

  const session = await api.post<Session>('/auth/telegram', { initData });
  storeToken(session);
  return session;
}

let inFlight: Promise<string | null> | null = null;

/**
 * What the API client calls after a 401. Never throws — a failed re-login is
 * simply "no token", and the client then surfaces the original error.
 *
 * Parallel requests tend to 401 together, so they share one exchange instead
 * of racing several logins that would each invalidate the last.
 */
export function reauthenticate(): Promise<string | null> {
  inFlight ??= loginWithTelegram()
    .then((session) => session?.token ?? null)
    .catch(() => null)
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}
