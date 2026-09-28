import type {
  PhoneLoginPayload,
  PhoneRegisterPayload,
  Session,
  SessionUser,
  TelegramWidgetAuthPayload
} from '@bookquest/shared';
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
 * The Mini App's sign-in. Resolves to null outside Telegram, where there is
 * no `initData` to exchange — that is not a failure; the caller (`useAuth`)
 * falls back to `status: 'unavailable'`, which the standalone web answers
 * with `loginWithWidget` instead, not a dead end. A rejected exchange
 * throws, because the caller decides what a refused sign-in means.
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

/**
 * The standalone web app's sign-in — Telegram's Login Widget calls back with
 * this shape (see `TelegramLoginWidget.tsx`), and the API verifies it with
 * `verifyLoginWidget`, a different check than the Mini App's `initData`.
 * Unlike `loginWithTelegram`, this always has something to send — there is
 * no "outside Telegram" case here, the widget IS the outside-Telegram case.
 */
export async function loginWithWidget(payload: TelegramWidgetAuthPayload): Promise<Session> {
  const session = await api.post<Session>('/auth/telegram-widget', payload);
  storeToken(session);
  return session;
}

/** The standalone web app's phone number sign-up. */
export async function registerWithPhone(payload: PhoneRegisterPayload): Promise<Session> {
  const session = await api.post<Session>('/auth/register', payload);
  storeToken(session);
  return session;
}

/** The standalone web app's phone number sign-in. */
export async function loginWithPhone(payload: PhoneLoginPayload): Promise<Session> {
  const session = await api.post<Session>('/auth/login', payload);
  storeToken(session);
  return session;
}

/**
 * Attaches a Telegram identity to the current session. No `storeToken` —
 * unlike the other sign-in calls, this doesn't issue a new session, it just
 * returns the updated `SessionUser` for the caller to write into the cache.
 */
export async function linkTelegram(payload: TelegramWidgetAuthPayload): Promise<SessionUser> {
  return api.post<SessionUser>('/auth/telegram/link', payload);
}
