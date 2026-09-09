import { useState } from 'react';
import { Navigate } from 'react-router';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { isNotFound } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { useCurrentQuest } from '@/lib/api/quest';
import { EditionMark } from './components/EditionMark';
import { RegistrationForm } from './components/RegistrationForm';

/**
 * The title page (spec §4). Ported from `prototype/index.html` view 1 and
 * `prototype/styles/register.css` — see `styles/register.css` for the
 * visual half.
 */
export function RegisterPage() {
  const { status, user } = useAuth();
  const { data: quest, isPending, error, refetch } = useCurrentQuest();

  // Someone who already claimed a place has nothing to do here — send them
  // to the stage that already knows their number (spec §3).
  if (user?.participant) return <Navigate to="/" replace />;

  if (isPending) return <LoadingState label="Setting the stage…" />;

  if (error) {
    // Between editions there is no quest to register for, and no form that
    // could submit anything even if it rendered.
    if (isNotFound(error)) {
      return (
        <Screen>
          <EmptyState title={error.message} body="Check back once the next edition opens." />
        </Screen>
      );
    }
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  return (
    <div className="view--register flex flex-1 flex-col">
      <div className="titlepage">
        <EditionMark edition={quest.edition} />

        <h1 className="titlepage__title">
          Enter
          <br />
          the&nbsp;quest
        </h1>

        <p className="lede">
          One book, one deadline, one quiz. Read before the clock runs out, then answer faster and
          better than everyone else. Everyone who finishes gets a certificate.
        </p>

        {status === 'authenticated' ? <RegistrationForm /> : <NoSessionNote status={status} />}
      </div>
    </div>
  );
}

/**
 * The endpoint requires a session, and read-only web mode never has one
 * (spec §7) — so the form is replaced, not shown and left to 401. `anonymous`
 * (inside Telegram, but the sign-in exchange failed) gets the actual fix —
 * retry — rather than being told to do the thing it's already doing.
 */
function NoSessionNote({ status }: { status: 'loading' | 'anonymous' | 'unavailable' }) {
  const { signIn } = useAuth();
  const [busy, setBusy] = useState(false);

  // The boot splash already covered the first resolve; this is a background
  // refetch and lasts a frame. Nothing beats flashing the wrong affordance.
  if (status === 'loading') return null;

  if (status === 'anonymous') {
    const retry = () => {
      setBusy(true);
      void signIn().finally(() => setBusy(false));
    };
    return (
      <div className="grid gap-3">
        <p className="type-label text-amber">We lost your session</p>
        <p className="max-w-[30rem] text-paper-dim">
          Telegram could not confirm who you are. Try once more — it usually takes.
        </p>
        <Button disabled={busy} onClick={retry} className="justify-self-start">
          {busy ? 'Signing in…' : 'Sign in again'}
        </Button>
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <p className="type-label text-amber">Continue in Telegram</p>
      <p className="max-w-[30rem] text-paper-dim">
        Open BookQuest inside Telegram to claim a place — that&rsquo;s how the quiz and certificate
        find you.
      </p>
    </div>
  );
}
