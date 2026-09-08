import { createContext, useCallback, useContext } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { SessionUser } from '@bookquest/shared';
import { getInitData } from '@/lib/telegram';
import { fetchMe, loginWithTelegram } from './authApi';
import { clearToken, readToken } from './tokenStore';

export const authKeys = {
  all: ['auth'] as const,
  me: () => [...authKeys.all, 'me'] as const
};

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous' | 'unavailable';

export interface Auth {
  status: AuthStatus;
  user: SessionUser | null;
  /** Presentation only — it changes what is rendered, never what is allowed. */
  isAdmin: boolean;
  /** Runs the `initData` exchange. Resolves to false when no session was created. */
  signIn: () => Promise<boolean>;
  signOut: () => void;
}

/**
 * True once `AuthProvider` has resolved the session once. Consumers never see
 * false — the provider holds the app on the boot splash until then — so its
 * real job is to make "useAuth outside the provider" fail loudly instead of
 * quietly reporting a signed-out user.
 */
export const AuthContext = createContext(false);

/**
 * The one way to ask who is using the app.
 *
 * `user` is server state and so lives in React Query; the token is neither
 * server nor React state and lives in `localStorage` (spec §5). Nothing is
 * duplicated between them — the token decides whether we may ask, the query
 * holds the answer.
 */
export function useAuth(): Auth {
  const resolved = useContext(AuthContext);
  if (!resolved) {
    throw new Error('useAuth was called outside <AuthProvider>. Mount it in app/providers.tsx.');
  }

  const queryClient = useQueryClient();

  const { data, isFetching } = useQuery({
    queryKey: authKeys.me(),
    queryFn: fetchMe,
    // Without a token there is nobody to ask, and asking anyway would spend a
    // guaranteed 401 on every page load of the open web.
    enabled: readToken() !== null
  });

  const user = data ?? null;

  const signIn = useCallback(async (): Promise<boolean> => {
    try {
      const session = await loginWithTelegram();
      if (!session) return false;
      // The exchange already returned the user, so seed the cache rather than
      // spend a round trip on /auth/me asking what we were just told.
      queryClient.setQueryData(authKeys.me(), session.user);
      return true;
    } catch {
      return false;
    }
  }, [queryClient]);

  const signOut = useCallback(() => {
    clearToken();
    queryClient.removeQueries({ queryKey: authKeys.all });
  }, [queryClient]);

  return {
    status: resolveStatus(user, isFetching),
    user,
    isAdmin: user?.role === 'admin',
    signIn,
    signOut
  };
}

function resolveStatus(user: SessionUser | null, isFetching: boolean): AuthStatus {
  if (user) return 'authenticated';
  if (isFetching) return 'loading';
  // `initData`, not `window.Telegram`, is the test: index.html loads Telegram's
  // script everywhere, so the object exists in a plain browser too and only the
  // signed payload tells the two apart. Nothing to sign in with is the open web,
  // read-only by design (spec §7); inside Telegram the same absence means the
  // sign-in failed, which is recoverable.
  return getInitData() === null ? 'unavailable' : 'anonymous';
}
