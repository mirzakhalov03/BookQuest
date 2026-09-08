import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { registerReauthenticate } from '@/lib/api/client';
import { fetchMe, loginWithTelegram, reauthenticate } from '@/lib/auth/authApi';
import { readToken } from '@/lib/auth/tokenStore';
import { AuthContext, authKeys } from '@/lib/auth/useAuth';
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
    } catch {
      // Don't leave the failure cached under the key a later sign-in writes to.
      queryClient.removeQueries({ queryKey: authKeys.all });
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

  // 3. No token, no bridge: read-only web. There is nothing to resolve.
}

// StrictMode runs effects twice in development, and a remount would run this
// again in production. One page load, one sign-in.
let booting: Promise<void> | null = null;

function bootSession(): Promise<void> {
  // client.ts cannot import the auth layer without a cycle, so the auth layer
  // hands it the re-login it needs — in place before the first request goes out.
  registerReauthenticate(reauthenticate);
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

  return <AuthContext value={true}>{children}</AuthContext>;
}
