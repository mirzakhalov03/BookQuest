import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ApiRequestError, registerReauthenticate } from '@/lib/api/client';
import { fetchMe, loginWithTelegram, reauthenticate } from '@/lib/auth/authApi';
import { readToken } from '@/lib/auth/tokenStore';
import { SessionResolvedContext, authKeys } from '@/lib/auth/useAuth';
import { BootSplash } from './BootSplash';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

/**
 * Resolves the session once per page load, in the order of spec §7. Deliberately
 * three plain branches rather than one clever expression: this is the seam every
 * other feature hangs off, and it should be readable at a glance.
 */
async function resolveSession(): Promise<void> {
  // 1. A stored token means there is already a session — ask who it belongs to.
  //    If the API rejects it, the client has cleared it by the time we get here.
  if (readToken() !== null) {
    try {
      await queryClient.fetchQuery({ queryKey: authKeys.me(), queryFn: fetchMe });
      return;
    } catch (error) {
      // Don't leave the failure cached under the key a later sign-in writes to.
      queryClient.removeQueries({ queryKey: authKeys.all });

      // A 401 has already cost this boot its one exchange: the client cleared
      // the token, ran the sign-in itself and replayed. Falling through to
      // branch 2 would spend a second one against a rate-limited endpoint for
      // an answer we just got. Any other failure — a 500, the network — never
      // reached the exchange, so branch 2 is still worth trying.
      if (error instanceof ApiRequestError && error.status === 401) return;
    }
  }

  // 2. Inside Telegram, trade initData for a session. The response carries the
  //    user, so seeding the cache saves a /auth/me round trip.
  try {
    const session = await loginWithTelegram();
    if (session) queryClient.setQueryData(authKeys.me(), session.user);
  } catch {
    // A refused exchange lands on `anonymous`. Throwing here would take the
    // public screens down over a sign-in nobody asked for yet.
  }

  // 3. No token, no Mini App bridge: nothing to resolve at boot — the
  //    standalone web's Login Widget creates a session later, on demand.
}

// StrictMode runs effects twice in development, and a remount would run this
// again in production. One page load, one sign-in.
let booting: Promise<void> | null = null;

function bootSession(): Promise<void> {
  // client.ts cannot import the auth layer without a cycle, so the auth layer
  // hands it the re-login it needs — in place before the first request goes out.
  //
  // Wrapped rather than passed straight through: `client.ts` clears the dead
  // token on a 401 but has no reason to know about React Query, so a refused
  // re-login (`token === null`) would otherwise leave `authKeys.me` cached
  // with the old `SessionUser` — `useAuth().status` reads 'authenticated'
  // forever, guards keep admitting a session that no longer exists, and every
  // later request spends its own failed exchange rediscovering that. Evicting
  // the cache here, behind the same seam, keeps that decision on this side of
  // the boundary instead of importing `queryClient` into `client.ts`.
  registerReauthenticate(async () => {
    const token = await reauthenticate();
    if (token === null) queryClient.removeQueries({ queryKey: authKeys.all });
    return token;
  });
  booting ??= resolveSession();
  return booting;
}

/**
 * Holds the app on the splash until the session is settled, so no screen paints
 * a signed-out state and then rearranges itself a moment later.
 */
function AuthProvider({ children }: { children: ReactNode }) {
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    let active = true;
    void bootSession().finally(() => {
      if (active) setResolved(true);
    });
    return () => {
      active = false;
    };
  }, []);

  if (!resolved) return <BootSplash />;

  return <SessionResolvedContext value={true}>{children}</SessionResolvedContext>;
}
