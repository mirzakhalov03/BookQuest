import { Link, Navigate } from 'react-router';
import type { Participant } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState, FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Rule } from '@/components/ui/Rule';
import { Button } from '@/components/ui/Button';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { useQuestArchive } from '@/lib/api/quest';
import { ApiRequestError, isNotFound } from '@/lib/api/client';
import { useAuth } from '@/lib/auth/useAuth';
import { formatOrdinalEdition } from '@/lib/format';
import { useParticipant } from './api/useParticipant';
import { useCertificate } from './api/useCertificate';
import { Certificate } from './components/Certificate';
import { ConnectTelegram } from './components/ConnectTelegram';

const CONTACT_LABELS: Record<Participant['contact']['method'], string> = {
  telegram: 'Telegram',
  phone: 'Phone'
};

/**
 * `/me` — session-only, mounted under `<RequireAuth>` in the router, so a
 * signed-in participant is the only thing this ever has to render for
 * (spec §3).
 *
 * A tab-bar root like `/results` — see `BookPage`'s note on why that means no
 * Telegram back button.
 */
export function ProfilePage() {
  const { isAdmin, user } = useAuth();
  const participant = useParticipant();

  if (participant.isPending) return <LoadingState label="Finding your number…" />;

  if (participant.error) {
    // Authenticated but never registered is a normal state, not a failure —
    // the form is one tap away, not an error screen (spec, contract).
    if (isNotFound(participant.error)) return <Navigate to="/register" replace />;

    return (
      <Screen>
        <ErrorState error={participant.error} onRetry={() => participant.refetch()} />
      </Screen>
    );
  }

  return (
    <Screen className="gap-8">
      <ProfileHeader participant={participant.data} />
      <QuestHistory />
      <CertificateSection />
      {!user?.telegramUserId && <ConnectTelegram />}
      {/* The Mini App sheet has no address bar, so `/admin` — four screens
          behind a route guard — was otherwise impossible to reach in the
          product's primary runtime (`useAuth().isAdmin` had no consumer that
          actually changed presentation, despite its own doc comment). A link
          here, rather than a sixth tab, because admin is a role an account
          has, not a sixth thing the product does — TabBar's five destinations
          stay exactly the design's five. */}
      {isAdmin && (
        <Link to="/admin" className="type-label self-start text-amber hover:text-paper-dim">
          Admin dashboard
        </Link>
      )}
    </Screen>
  );
}

function ProfileHeader({ participant }: { participant: Participant }) {
  return (
    <header className="flex flex-col gap-2">
      <p className="type-label">Your number</p>
      <ParticipantNumeral value={participant.number} className="type-display text-5xl text-gold" />
      <h1 className="type-display m-0 text-2xl text-paper">{participant.fullName}</h1>
      <p className="text-sm text-taupe">
        {CONTACT_LABELS[participant.contact.method]} · {participant.contact.value}
      </p>
    </header>
  );
}

/**
 * Minimal scope, per the plan: the archive's first page, nothing paginated
 * here — `/quests` already does that job. A failure or a slow load here
 * shouldn't hold the rest of the profile hostage, so this degrades quietly
 * instead of reaching for `ErrorState`, which is written for a whole screen.
 */
function QuestHistory() {
  const { data, isPending, error } = useQuestArchive();

  if (isPending) return <p className="type-label">Loading your history…</p>;
  if (error) return null;

  const editions = data.pages[0]?.items ?? [];
  if (editions.length === 0) return null;

  return (
    <section className="flex flex-col gap-1">
      <p className="type-label">Editions you've been part of</p>
      <Rule />
      <ul className="flex flex-col">
        {editions.map((quest) => (
          <li key={quest.id} className="border-b border-[var(--rule)] py-2.5 last:border-none">
            <Link to={`/quests/${quest.edition}`} className="text-paper-dim hover:text-paper">
              {formatOrdinalEdition(quest.edition)} · {quest.year} — {quest.bookTitle}
            </Link>
          </li>
        ))}
      </ul>
      <Link to="/quests" className="type-label self-start text-taupe hover:text-paper-dim">
        See the full archive
      </Link>
    </section>
  );
}

/**
 * `404 not_found` here covers two real states at once (spec, contract): never
 * sat the quiz, or results not published — "today that is everyone." Neither
 * is an error, so this never reaches for `ErrorState`'s retry framing for it.
 */
function CertificateSection() {
  const certificate = useCertificate();

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label">Your certificate</p>
      <Rule variant="gold" />

      {certificate.isPending && <p className="text-taupe">Checking…</p>}

      {certificate.error &&
        (isNotFound(certificate.error) ? (
          <p className="max-w-sm text-taupe-dim">
            Your certificate appears once you've completed the quiz and the results are published.
          </p>
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
