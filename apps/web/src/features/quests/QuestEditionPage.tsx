import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router';
import type { Quest } from '@bookquest/shared';
import { BookHero } from '@/components/BookHero';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { ApiRequestError } from '@/lib/api/client';
import { formatCount, formatLongDate } from '@/lib/format';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useQuestByEdition } from './api/useQuestByEdition';

// The same forward arrow every other "go here next" action uses (spec:
// reuse it rather than drawing a fourth one) — even though the destination is
// up a level, the action itself reads the same way "Enter the quest" does.
const BACK_TO_ARCHIVE = (
  <Link
    to="/quests"
    className="group inline-flex items-center gap-3 text-taupe transition-colors hover:text-paper-dim"
  >
    Back to the archive
    <ArrowIcon />
  </Link>
);

/**
 * One past edition. Reached from a card in the archive, or a direct link
 * someone shares — either way it has a real parent (`/quests`), so unlike
 * `/book` and `/quests` this one does get the Telegram back button.
 */
export function QuestEditionPage() {
  useTelegramBackButton('/quests');

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
          title="That's not an edition number"
          body="Editions are numbered from the archive, not chosen freely."
          action={BACK_TO_ARCHIVE}
        />
      </Screen>
    );
  }

  if (isPending) return <LoadingState label="Turning back the pages…" />;

  if (error) {
    // A 404 here means the number in the URL doesn't exist — nothing about
    // that resolves itself on retry, so it gets the invitation back to the
    // archive rather than an ErrorState's "try again" (spec §4: an invitation,
    // not an apology). Anything else is a real failure and keeps its retry.
    if (error instanceof ApiRequestError && error.status === 404 && error.code === 'not_found') {
      return (
        <Screen>
          <EmptyState title={error.message} body="Browse every edition from the archive instead." action={BACK_TO_ARCHIVE} />
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

      <p className="text-paper-dim">{formatCount(quest.participantCount)} people took part.</p>
    </Screen>
  );
}

function DatesSection({ quest }: { quest: Quest }) {
  return (
    <section className="flex flex-col gap-2">
      <p className="type-label">Dates</p>
      <dl className="flex flex-col gap-1">
        <FactRow label="Opened" value={formatLongDate(quest.opensAt)} />
        <FactRow label="Reading deadline" value={formatLongDate(quest.readingDeadline)} />
        <FactRow label="Quiz" value={formatLongDate(quest.quizOpensAt)} />
        <FactRow label="Results" value={formatLongDate(quest.resultsAt)} />
      </dl>
    </section>
  );
}

/**
 * Free text, and every one of the three is nullable (spec, contract) — the
 * seeded quest has none set. Rendering three empty rows for a quest with no
 * prizes yet would read as broken, so a place with nothing to show doesn't
 * get a row, and the whole section disappears once none do.
 */
function PrizesSection({ prizes }: { prizes: Quest['prizes'] }) {
  const rows: Array<{ place: string; prize: string | null }> = [
    { place: '1st', prize: prizes.first },
    { place: '2nd', prize: prizes.second },
    { place: '3rd', prize: prizes.third }
  ];
  const wonRows = rows.filter(
    (row): row is { place: string; prize: string } => row.prize !== null
  );

  if (wonRows.length === 0) return null;

  return (
    <section className="flex flex-col gap-2">
      <p className="type-label">Prizes</p>
      <dl className="flex flex-col gap-1">
        {wonRows.map((row) => (
          <FactRow key={row.place} label={row.place} value={row.prize} />
        ))}
      </dl>
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
