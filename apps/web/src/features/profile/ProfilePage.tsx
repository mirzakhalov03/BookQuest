import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState, FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Rule } from '@/components/ui/Rule';
import { Button } from '@/components/ui/Button';
import { ApiRequestError, isNotFound } from '@/lib/api/client';
import { useParticipant } from '@/lib/api/participant';
import { useCurrentQuest } from '@/lib/api/quest';
import { useAuth } from '@/lib/auth/useAuth';
import { JoinQuest } from '@/features/registration/JoinQuest';
import { useCertificate } from './api/useCertificate';
import { Avatar } from './components/Avatar';
import { Certificate } from './components/Certificate';
import { ConnectTelegram } from './components/ConnectTelegram';
import { LogoutIcon } from './components/LogoutIcon';

/**
 * `/me` — session-only, mounted under `<RequireAuth>` in the router, so a
 * signed-in participant is the only thing this ever has to render for
 * (spec §3).
 *
 * A tab-bar root like `/results` — see `BookPage`'s note on why that means no
 * Telegram back button.
 */
export function ProfilePage() {
  const { user, signOut } = useAuth();
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
      <ProfileHeader
        name={participant.data.fullName}
        number={participant.data.number}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
        onSignOut={signOut}
      />
      <CertificateSection />
      <ProfileAction />
    </Screen>
  );
}

/**
 * Joining is only possible while the quest is `upcoming` or `reading` (the server
 * closes registration at the reading deadline); otherwise show who they are and when to come back.
 */
function NotJoined() {
  const { user, signOut } = useAuth();
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
      <ProfileHeader
        name={user?.firstName ?? 'Reader'}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
        onSignOut={signOut}
      />
      <p className="max-w-sm text-taupe-dim">
        {quest.data
          ? 'Registration for this edition has closed. See you at the next one.'
          : 'The next edition opens soon.'}
      </p>
      <ProfileAction />
    </Screen>
  );
}

/**
 * The Mini App sheet has no address bar, so `/admin` — four screens behind a
 * route guard — was otherwise impossible to reach in the product's primary
 * runtime. An admin sees this button instead of Connect Telegram, not
 * alongside it — the slot is "the one thing left to do here," and for an
 * admin that's the dashboard, not linking Telegram.
 */
function ProfileAction() {
  const { isAdmin, user } = useAuth();
  if (isAdmin) {
    return (
      <Button to="/admin" variant="primary" className="self-start">
        Admin dashboard
      </Button>
    );
  }
  return user?.telegramUserId ? null : <ConnectTelegram />;
}

function ProfileHeader({
  name,
  number,
  telegramUsername,
  phoneNumber,
  onSignOut
}: {
  name: string;
  number?: number;
  telegramUsername?: string | null;
  phoneNumber?: string | null;
  onSignOut: () => void;
}) {
  return (
    <header className="flex flex-col gap-5">
      <div className="screen-bleed relative flex items-center justify-center rounded-b-[3px] border-b border-[color:var(--rule)] bg-[color:var(--color-ash)] py-12">
        <button
          type="button"
          onClick={onSignOut}
          aria-label="Log out"
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-[3px] border border-[color:var(--rule)] text-taupe hover:text-paper-dim"
        >
          <LogoutIcon />
        </button>
        <Avatar />
      </div>

      <div className="flex flex-col gap-3">
        <h1 className="type-display m-0 text-center text-2xl text-paper">{name}</h1>
        <div className="flex flex-col gap-1.5">
          {number !== undefined && <InfoRow label="Reg. Number" value={`#${number}`} />}
          {telegramUsername && <InfoRow label="Telegram" value={`@${telegramUsername}`} />}
          {phoneNumber && <InfoRow label="Phone Number" value={phoneNumber} />}
        </div>
      </div>
    </header>
  );
}

/** A label, a dotted leader, a value — the ticket-stub layout the design asked for. */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-end gap-2">
      <span className="shrink-0 text-sm text-taupe">{label}</span>
      <span aria-hidden="true" className="mb-[3px] flex-1 border-b border-dotted border-[color:var(--rule)]" />
      <span className="shrink-0 text-sm text-paper-dim">{value}</span>
    </div>
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
      <p className="type-label">Your Certificates & Awards</p>
      <Rule variant="gold" />

      {certificate.isPending && <p className="text-taupe">Checking…</p>}

      {certificate.error &&
        (isNotFound(certificate.error) ? (
          <p className="max-w-sm text-taupe-dim">Appears once you finish the quiz and results are published.</p>
        ) : (
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
        ))}

      {certificate.data && <Certificate data={certificate.data} />}
    </section>
  );
}
