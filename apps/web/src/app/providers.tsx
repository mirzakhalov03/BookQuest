import { useEffect, useState, type ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/queryClient';
import { ApiRequestError, registerReauthenticate } from '@/lib/api/client';
import { fetchMe, loginWithTelegram, reauthenticate } from '@/lib/auth/authApi';
import { clearToken, readToken } from '@/lib/auth/tokenStore';
import { getInitDataUserId } from '@/lib/telegram';
import { SessionResolvedContext, authKeys } from '@/lib/auth/useAuth';
import { BootSplash } from './BootSplash';

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}

/** Resolves the session once per page load, in spec §7 order: three plain branches, readable at a glance. */
async function resolveSession(): Promise<void> {
  // 1. A stored token: ask who it belongs to (a rejected one is already cleared).
  if (readToken() !== null) {
    try {
      const me = await queryClient.fetchQuery({ queryKey: authKeys.me(), queryFn: fetchMe });
      const telegramUserId = getInitDataUserId();
      if (telegramUserId === null || me.telegramUserId === telegramUserId) return;

      // Inside Telegram as someone other than the stored session: Telegram decides. Fall through to branch 2.
      clearToken();
      queryClient.removeQueries({ queryKey: authKeys.all });
    } catch (error) {
      // Don't leave the failure cached under the key a later sign-in writes to.
      queryClient.removeQueries({ queryKey: authKeys.all });

      // A 401 already spent this boot's one exchange (the client re-signed-in and replayed); don't spend a second.
      // Any other failure never reached the exchange, so branch 2 is still worth trying.
      if (error instanceof ApiRequestError && error.status === 401) return;
    }
  }

  // 2. Inside Telegram, trade initData for a session; seeding the cache saves a /auth/me trip.
  try {
    const session = await loginWithTelegram();
    if (session) queryClient.setQueryData(authKeys.me(), session.user);
  } catch {
    // A refused exchange lands on `anonymous`; throwing would take public screens down.
  }

  // 3. Plain web, no token: the Login Widget creates a session later, on demand.
}

// StrictMode and remounts would run this twice. One page load, one sign-in.
let booting: Promise<void> | null = null;

function bootSession(): Promise<void> {
  // Handed to client.ts to avoid an import cycle. Wrapped so a refused re-login also evicts the cached
  // user; otherwise guards would keep admitting a session that no longer exists.
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
