import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Quest } from '@bookquest/shared';
import { BookHero } from '@/components/BookHero';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { isNotFound } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errorMessage';
import { formatCount, formatLongDate } from '@/lib/format';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useQuestByEdition } from './api/useQuestByEdition';
import { PrizePodium, hasAnyPrize } from './components/PrizePodium';
import { useT } from '@/i18n';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';

// Same forward arrow as every other "go here next" action, even though this goes up a level.
function BackToArchive() {
  const t = useT();
  return (
    <Link
      to="/prizes"
      className="group inline-flex items-center gap-3 text-taupe transition-colors hover:text-paper-dim"
    >
      {t.prizes.backToPrizes}
      <ArrowIcon />
    </Link>
  );
}

/**
 * One past edition. Reached from a card on `/prizes` or a shared link. Either way
 * `/prizes` is its parent, so unlike the tab screens it gets the Telegram back button.
 */
export function QuestEditionPage() {
  usePullToRefresh();
  useTelegramBackButton('/prizes');
  const t = useT();

  const { edition: editionParam } = useParams<{ edition: string }>();
  const edition = Number(editionParam);
  const editionIsValid = Number.isInteger(edition) && edition > 0;

  const { data: quest, isPending, error, refetch } = useQuestByEdition(edition, {
    enabled: editionIsValid
  });

  if (!editionIsValid) {
    return (
      <Screen>
        <EmptyState
          title={t.prizes.badEditionTitle}
          body={t.prizes.badEditionBody}
          action={<BackToArchive />}
        />
      </Screen>
    );
  }

  if (isPending) return <LoadingState label={t.prizes.editionLoading} />;

  if (error) {
    // A 404 here means the number in the URL doesn't exist — nothing about
    // that resolves itself on retry, so it gets the invitation back to the
    // archive rather than an ErrorState's "try again" (spec §4: an invitation,
    // not an apology). Anything else is a real failure and keeps its retry.
    if (isNotFound(error)) {
      return (
        <Screen>
          <EmptyState title={errorMessage(error)} body={t.prizes.browseInstead} action={<BackToArchive />} />
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
    <Screen className="gap-8">
      <BookHero
        edition={quest.edition}
        year={quest.year}
        title={quest.book.title}
        author={quest.book.author}
        pages={quest.book.pages}
        coverUrl={quest.book.coverUrl}
      />

      <DatesSection quest={quest} />
      <PrizesSection prizes={quest.prizes} />

      <p className="text-paper-dim">{t.prizes.tookPart(formatCount(quest.participantCount))}</p>
    </Screen>
  );
}

function DatesSection({ quest }: { quest: Quest }) {
  const t = useT().prizes;
  return (
    <section className="flex flex-col gap-2">
      <p className="type-label">{t.dates}</p>
      <dl className="flex flex-col gap-1">
        <FactRow label={t.opened} value={formatLongDate(quest.opensAt)} />
        <FactRow label={t.readingDeadline} value={formatLongDate(quest.readingDeadline)} />
        <FactRow label={t.quiz} value={formatLongDate(quest.quizOpensAt)} />
        <FactRow label={t.results} value={formatLongDate(quest.resultsAt)} />
      </dl>
    </section>
  );
}

function PrizesSection({ prizes }: { prizes: Quest['prizes'] }) {
  const t = useT();
  if (!hasAnyPrize(prizes)) return null;

  return (
    <section className="flex flex-col gap-2">
      <p className="type-label">{t.prizes.label}</p>
      <PrizePodium prizes={prizes} />
    </section>
  );
}

function FactRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 text-sm">
      <dt className="text-taupe">{label}</dt>
      <dd className="text-paper-dim">{value}</dd>
    </div>
  );
}
