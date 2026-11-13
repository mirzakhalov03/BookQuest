import { LayoutDashboard, LogOut } from 'lucide-react';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { isNotFound } from '@/lib/api/client';
import { useParticipant } from '@/lib/api/participant';
import { useCurrentQuest } from '@/lib/api/quest';
import { useAuth } from '@/lib/auth/useAuth';
import { JoinQuest } from '@/features/registration/JoinQuest';
import { useCertificate } from './api/useCertificate';
import { AccountList, AccountRow } from './components/AccountRow';
import { Certificate } from './components/Certificate';
import { CertificateTeaser } from './components/CertificateTeaser';
import { isResultsOut } from '@bookquest/shared';
import { ConnectTelegram } from './components/ConnectTelegram';
import { ReaderPass } from './components/ReaderPass';
import { useT } from '@/i18n';
import { LanguagePicker } from './components/LanguagePicker';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

/**
 * `/me` — session-only, mounted under `<RequireAuth>` in the router, so a
 * signed-in participant is the only thing this ever has to render for
 * (spec §3).
 *
 * A tab-bar root like `/results` — see `BookPage`'s note on why that means no
 * Telegram back button.
 */
export function ProfilePage() {
  usePullToRefresh();
  const { user } = useAuth();
  const t = useT();
  const participant = useParticipant();

  if (participant.isPending) return <LoadingState label={t.profile.loading} />;

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
        userId={user?.id}
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
  const t = useT();
  const quest = useCurrentQuest();

  if (quest.isPending) return <LoadingState label={t.home.loading} />;

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
        userId={user?.id}
        name={user?.firstName ?? t.profile.readerFallback}
        avatar={user?.avatar ?? null}
        telegramUsername={user?.telegramUserId ? user.username : null}
        phoneNumber={user?.phoneNumber ?? null}
      />
      <p className="max-w-sm text-taupe-dim">
        {quest.data
          ? t.profile.registrationClosed
          : t.profile.nextEditionSoon}
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
  const t = useT();

  return (
    <section className="flex flex-col gap-4">
      {!isAdmin && !user?.telegramUserId && <ConnectTelegram />}
      <LanguagePicker />
      <AccountList>
        {isAdmin && (
          <AccountRow icon={LayoutDashboard} to="/admin">
            {t.profile.adminDashboard}
          </AccountRow>
        )}
        <AccountRow icon={LogOut} onClick={signOut}>
          {t.common.logOut}
        </AccountRow>
      </AccountList>
    </section>
  );
}

/**
 * Never shows a loader: the placeholder stands until a certificate exists (null = not yet:
 * never sat the quiz, or results not out), and a background refresh swaps it in. A failed
 * refresh keeps whatever was showing.
 *
 * Plural heading per the design; the backend only ever has the one current-quest certificate.
 */
function CertificateSection() {
  const { data } = useCertificate();
  const { data: quest } = useCurrentQuest();
  const t = useT().profile;
  const resultsOut = quest ? isResultsOut(quest) : false;

  return (
    <section className="flex flex-col gap-3">
      <p className="type-label m-0">{t.certificates}</p>
      {data ? (
        <Certificate data={data} />
      ) : resultsOut ? (
        <p className="m-0 text-taupe">{t.certMissed}</p>
      ) : (
        <CertificateTeaser resultsAt={quest?.resultsAt ?? null} />
      )}
    </section>
  );
}
