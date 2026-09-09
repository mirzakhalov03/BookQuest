import { useState, type ReactNode } from 'react';
import { Navigate, Outlet } from 'react-router';
import { Button } from '@/components/ui/Button';
import { useAuth } from './useAuth';

/**
 * Route guards — **UX, not security.**
 *
 * They exist so nobody is walked into a screen that will answer 401 or 403.
 * Every endpoint behind them re-checks the session and the role server-side on
 * every single call, so someone who flips a flag in devtools gets an admin
 * shell full of "forbidden" and changes nothing.
 *
 * Both are layout routes: they render their children through <Outlet />, so a
 * later task mounts a whole subtree under one guard.
 */

export function RequireAuth() {
  const { status } = useAuth();

  switch (status) {
    case 'authenticated':
      return <Outlet />;
    // The boot splash already covered the first resolve, so this is a refetch
    // and lasts a frame. Showing nothing beats flashing a sign-in prompt at
    // someone who is signed in.
    case 'loading':
      return null;
    case 'anonymous':
      return <SignInAgain />;
    case 'unavailable':
      return <ContinueInTelegram />;
  }
}

export function RequireAdmin() {
  const { status, isAdmin } = useAuth();

  // Not signed in is the more useful thing to say, so answer that first.
  if (status !== 'authenticated') return <RequireAuth />;

  // Nothing to explain to someone who was never meant to see this exists.
  if (!isAdmin) return <Navigate to="/" replace />;

  return <Outlet />;
}

/** Read-only web: there is no bridge here, so there is nothing to sign in with. */
function ContinueInTelegram() {
  return (
    <Panel label="Read-only">
      <h1 className="type-display text-4xl">Continue in Telegram</h1>
      <p className="max-w-[34ch] text-paper-dim">
        This part of BookQuest needs to know who you are, and only the Telegram Mini App can say.
        Everything else — the book, the deadline, past quests — is here on the web.
      </p>
    </Panel>
  );
}

/** Inside Telegram, but the exchange was refused. Offer the one thing that helps. */
function SignInAgain() {
  const { signIn } = useAuth();
  // Local, and it never leaves this panel: the outcome of the sign-in is the
  // auth query, so only the waiting is state (spec §5).
  const [busy, setBusy] = useState(false);

  const retry = () => {
    setBusy(true);
    void signIn().finally(() => setBusy(false));
  };

  return (
    <Panel label="Not signed in">
      <h1 className="type-display text-4xl">We lost your session</h1>
      <p className="max-w-[34ch] text-paper-dim">
        Telegram could not confirm who you are. Try once more — it usually takes.
      </p>
      <Button className="mt-2 self-start" disabled={busy} onClick={retry}>
        {busy ? 'Signing in…' : 'Sign in again'}
      </Button>
    </Panel>
  );
}

function Panel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-4 p-6">
      <p className="type-label">{label}</p>
      {children}
    </div>
  );
}
