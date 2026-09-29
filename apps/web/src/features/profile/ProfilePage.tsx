import { Award, LayoutDashboard, LogOut } from 'lucide-react';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState, FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { ApiRequestError, isNotFound } from '@/lib/api/client';
import { useParticipant } from '@/lib/api/participant';
import { useCurrentQuest } from '@/lib/api/quest';
import { useAuth } from '@/lib/auth/useAuth';
import { JoinQuest } from '@/features/registration/JoinQuest';
import { useCertificate } from './api/useCertificate';
import { AccountList, AccountRow } from './components/AccountRow';
import { Certificate } from './components/Certificate';
import { ConnectTelegram } from './components/ConnectTelegram';
import { ReaderPass } from './components/ReaderPass';

/**
 * `/me` — session-only, mounted under `<RequireAuth>` in the router, so a
 * signed-in participant is the only thing this ever has to render for
 * (spec §3).
 *
 * A tab-bar root like `/results` — see `BookPage`'s note on why that means no
 * Telegram back button.
 */
export function ProfilePage() {
  const { user } = useAuth();
  const participant = useParticipant();

  if (participant.isPending) return <LoadingState label="Finding your number…" />;

  if (participant.error) {
    // Signed in but not in this edition: join right here instead of being sent elsewhere.
    if (isNotFound(participant.error)) return <NotJoined />;

    return (
      <Screen>
        <ErrorState error={participant.error} onRetry={() => participant.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen className="gap-8">
      <ReaderPass
        name={participant.data.fullName}
        avatar={user?.avatar ?? null}
        number={participant.data.number}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
      />
      <CertificateSection />
      <AccountSection />
    </Screen>
  );
}

/**
 * Joining is only possible while the quest is `upcoming` or `reading` (the server
 * closes registration at the reading deadline); otherwise show who they are and when to come back.
 */
function NotJoined() {
  const { user } = useAuth();
  const quest = useCurrentQuest();

  if (quest.isPending) return <LoadingState label="Setting the stage…" />;

  if (quest.data && (quest.data.phase === 'upcoming' || quest.data.phase === 'reading')) {
    return <JoinQuest quest={quest.data} />;
  }

  if (quest.error && !isNotFound(quest.error)) {
    return (
      <Screen>
        <ErrorState error={quest.error} onRetry={() => quest.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen className="gap-8">
      <ReaderPass
        name={user?.firstName ?? 'Reader'}
        avatar={user?.avatar ?? null}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
      />
      <p className="max-w-sm text-taupe-dim">
        {quest.data
          ? 'Registration for this edition has closed. See you at the next one.'
          : 'The next edition opens soon.'}
      </p>
      <AccountSection />
    </Screen>
  );
}

/**
 * The foot of `/me`. The Mini App sheet has no address bar, so the admin row
 * is the only way into `/admin` there. Connect Telegram sits above the list
 * for non-admins only — for an admin, the dashboard is "the thing left to do".
 */
function AccountSection() {
  const { isAdmin, user, signOut } = useAuth();

  return (
    <section className="flex flex-col gap-4">
      {!isAdmin && !user?.telegramUserId && <ConnectTelegram />}
      <AccountList>
        {isAdmin && (
          <AccountRow icon={LayoutDashboard} to="/admin">
            Admin dashboard
          </AccountRow>
        )}
        <AccountRow icon={LogOut} onClick={signOut}>
          Log out
        </AccountRow>
      </AccountList>
    </section>
  );
}

/**
 * `404 not_found` here covers two real states at once (spec, contract): never
 * sat the quiz, or results not published — "today that is everyone." Neither
 * is an error, so this never reaches for `ErrorState`'s retry framing for it.
 *
 * Heading says "Certificates & Awards" — plural, matching the design — but
 * the backend only ever has the one, current-quest certificate to give it
 * (spec, contract has no awards concept yet). Nothing here fakes a list.
 */
function CertificateSection() {
  const certificate = useCertificate();

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label m-0">Certificates & awards</p>

      {(certificate.isPending || (certificate.error && isNotFound(certificate.error))) && (
        <div className="cert-slot">
          <Award className="h-8 w-8 shrink-0 text-gold" strokeWidth={1.5} aria-hidden="true" />
          <div className="flex flex-col gap-0.5">
            <p className="m-0 text-paper-dim">
              {certificate.isPending ? 'Checking…' : 'Your certificate lands here'}
            </p>
            {!certificate.isPending && (
              <p className="m-0 text-sm text-taupe-dim">
                Finish the quiz — it appears once results are published.
              </p>
            )}
          </div>
        </div>
      )}

      {certificate.error && !isNotFound(certificate.error) && (
        <div className="flex flex-col items-start gap-2">
          <p className="max-w-sm text-paper-dim">
            {certificate.error instanceof ApiRequestError
              ? certificate.error.message
              : FALLBACK_MESSAGE}
          </p>
          <Button variant="quiet" onClick={() => certificate.refetch()}>
            Try again
          </Button>
        </div>
      )}

      {certificate.data && <Certificate data={certificate.data} />}
    </section>
  );
}
