import { useMemo } from 'react';
import type { Quest } from '@bookquest/shared';
import { useCurrentQuest } from '@/features/home/api/useCurrentQuest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ApiRequestError } from '@/lib/api/client';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCount, formatLongDate } from '@/lib/format';
import { useAdminStats } from './api/useAdminStats';
import { ForbiddenState, isForbidden } from './components/ForbiddenState';

/**
 * `/admin` — the dashboard, and the root of the admin tree (like Home is the
 * root of the participant one), so it gets no Telegram back button; the
 * three screens under it do — see `useTelegramBackButton`'s reasoning and
 * `ParticipantsPage`/`QuestEditorPage`/`ResultsInspectionPage`, which all
 * name this route as their parent.
 *
 * Two queries feed one screen: `useAdminStats` for the counts, and
 * `useCurrentQuest` — the same cached query Home reads (spec §6) — for the
 * dates "days remaining" counts down to. Neither is optional; a dashboard
 * missing either number is just a smaller dashboard, not a broken one, but
 * both come from the same "is a quest even running" fact, so in practice
 * they succeed or 404 together.
 */
export function DashboardPage() {
  const stats = useAdminStats();
  const quest = useCurrentQuest();

  const isPending = stats.isPending || quest.isPending;
  const error = stats.error ?? quest.error;

  // Memoised on the ISO string, not a fresh `Date` every render — the same
  // reason Home's own countdown target is (see `HomePage.tsx`): a new Date
  // instance each render would change `useCountdown`'s effect dependency
  // every time and the tick would never settle.
  const targetIso = quest.data ? countdownTargetIso(quest.data) : null;
  const target = useMemo(() => (targetIso ? new Date(targetIso) : null), [targetIso]);
  const { days } = useCountdown(target);

  if (isPending) return <LoadingState label="Reading the register…" />;

  if (error) {
    if (isForbidden(error)) return <ForbiddenState error={error} />;

    if (error instanceof ApiRequestError && error.status === 404 && error.code === 'not_found') {
      return (
        <EmptyState
          title={error.message}
          body="There is nothing to administer between editions. Start the next one from the quest editor once it's ready."
          className="flex-1"
        />
      );
    }

    return (
      <ErrorState
        error={error}
        onRetry={() => {
          void stats.refetch();
          void quest.refetch();
        }}
        className="flex-1"
      />
    );
  }

  // `isPending`/`error` above are two separate queries' worth of checks, so
  // TS can't narrow either `.data` from them alone. Both queries are settled
  // and error-free by this line — this is just proving it to the compiler.
  if (!stats.data || !quest.data) return null;

  return (
    <AdminScreen>
      <header className="flex flex-col gap-1">
        <p className="type-label">Dashboard</p>
        <h1 className="type-display text-3xl text-paper">
          {quest.data.book.title}, edition {quest.data.edition}
        </h1>
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Participants" value={formatCount(stats.data.participants)} />
        <StatCard label="Registered today" value={formatCount(stats.data.registeredToday)} />
        <StatCard label="Quiz submitted" value={formatCount(stats.data.quizSubmitted)} />
        <StatCard
          label={daysRemainingLabel(quest.data.phase)}
          value={target ? String(days) : '—'}
        />
      </div>

      <div className="flex flex-col gap-1 border-t border-[color:var(--rule)] pt-4 text-sm">
        <p className="text-taupe">
          Phase: <span className="text-paper-dim">{stats.data.phase}</span>
        </p>
        <p className="text-taupe">{daysRemainingCaption(quest.data)}</p>
      </div>
    </AdminScreen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--color-ash)] px-4 py-3">
      <p className="type-label">{label}</p>
      <p className="type-display tabular-nums text-2xl text-paper">{value}</p>
    </div>
  );
}

/**
 * Renders `phase`, never derives it (spec §4 rule 4) — this only picks
 * *which* backend-owned date the clock watches, the same branch `HomePage`
 * makes for its own countdown. `null` (finished) means frozen: there is
 * nothing left on the calendar to count down to.
 */
function countdownTargetIso(quest: Quest): string | null {
  switch (quest.phase) {
    case 'upcoming':
      return quest.opensAt;
    case 'reading':
      return quest.readingDeadline;
    case 'quiz':
      return quest.quizClosesAt;
    case 'finished':
      return null;
  }
}

function daysRemainingLabel(phase: Quest['phase']): string {
  switch (phase) {
    case 'upcoming':
      return 'Days to open';
    case 'reading':
      return 'Days to deadline';
    case 'quiz':
      return 'Days to quiz close';
    case 'finished':
      return 'Days remaining';
  }
}

function daysRemainingCaption(quest: Quest): string {
  switch (quest.phase) {
    case 'upcoming':
      return `Opens ${formatLongDate(quest.opensAt)}.`;
    case 'reading':
      return `Reading deadline ${formatLongDate(quest.readingDeadline)}.`;
    case 'quiz':
      return `Quiz closes ${formatLongDate(quest.quizClosesAt)}.`;
    case 'finished':
      return `Results published ${formatLongDate(quest.resultsAt)}.`;
  }
}
