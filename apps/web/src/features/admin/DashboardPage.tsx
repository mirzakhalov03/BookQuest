import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Award, CircleHelp, Image, Lock, type LucideIcon } from 'lucide-react';
import type { AdminQuest } from '@bookquest/shared';
import { useAdminCurrentQuest } from './api/useAdminCurrentQuest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { BookCover } from '@/components/BookCover';
import { Button } from '@/components/ui/Button';
import { formatCount, formatLongDate } from '@/lib/format';
import { usePullToRefresh } from '@/hooks/usePullToRefresh';
import { useAdminStats } from './api/useAdminStats';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { ForbiddenState, isForbidden } from './components/ForbiddenState';
import { canStartNextEdition } from './phase';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

/** `/admin` — where the quest stands and the one or two things worth doing about it. */
export function DashboardPage() {
  usePullToRefresh();
  const t = useT().admin.dashboard;
  const quest = useAdminCurrentQuest();

  return (
    <AdminQuery
      query={quest}
      loadingLabel={t.loading}
      notFound={(error) => (
        <EmptyState
          title={errorMessage(error)}
          body={t.betweenEditions}
          action={<Button to="/admin/quest/new">{t.startNext}</Button>}
          className="flex-1"
        />
      )}
    >
      {(data) => <Dashboard quest={data} />}
    </AdminQuery>
  );
}

// Small enough to sit beside the two-line title; 1.47 is the cover's aspect ratio.
const COVER_W_REM = 4.75;
const COVER_STYLE = {
  '--book-w': `${COVER_W_REM}rem`,
  height: `${COVER_W_REM * 1.47}rem`,
  boxShadow: '0 8px 20px -8px rgba(0, 0, 0, 0.9)'
} as CSSProperties;

function Dashboard({ quest }: { quest: AdminQuest }) {
  const stats = useAdminStats();
  const t = useT().admin.dashboard;
  const [now] = useState(() => new Date());
  // AdminQuery already handles a 403 on the quest; this covers stats failing on its own.
  if (isForbidden(stats.error)) return <ForbiddenState error={stats.error} />;

  const count = (value: number | undefined) => (value === undefined ? '—' : formatCount(value));

  return (
    <AdminScreen>
      <AdminPageHeader
        title={quest.book.title}
        actions={
          <div className="cover-box" style={COVER_STYLE}>
            <BookCover title={quest.book.title} author={quest.book.author} coverUrl={quest.book.coverUrl} />
          </div>
        }
      />

      {!quest.bookRevealed && (
        <Link
          to="/admin/quest"
          className="inline-flex min-h-8 items-center gap-1.5 self-start rounded-chip border border-amber/40 bg-amber/10 px-2.5 text-sm text-amber"
        >
          <Lock className="size-3.5" aria-hidden="true" />
          {t.bookHidden}
        </Link>
      )}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        <StatCard label={t.statParticipants} value={count(stats.data?.participants)} />
        <StatCard label={t.statJoinedToday} value={count(stats.data?.registeredToday)} />
        <StatCard label={t.statSubmitted} value={count(stats.data?.quizSubmitted)} />
        <StatCard label={t.statInProgress} value={count(stats.data?.quizInProgress)} />
      </div>

      <NextSteps quest={quest} now={now} />

    </AdminScreen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] px-2.5 py-2 sm:px-3 sm:py-3">
      <p className="type-label m-0 truncate text-[0.5625rem] tracking-[0.06em] sm:text-[0.6875rem] sm:tracking-[var(--tracking-label)]">
        {label}
      </p>
      <p className="type-display m-0 tabular-nums text-lg text-paper sm:text-2xl">{value}</p>
    </div>
  );
}

// No `to` yet means the page isn't built: shown as "Soon" rather than linking to "Nothing here".
const QUICK_ACTIONS: { to?: string; key: 'actionQuizzes' | 'actionCertificates' | 'actionPosters'; icon: LucideIcon }[] = [
  { to: '/admin/quizzes', key: 'actionQuizzes', icon: CircleHelp },
  { key: 'actionCertificates', icon: Award },
  { key: 'actionPosters', icon: Image }
];

const TILE = 'flex min-w-0 flex-col items-center gap-2 rounded-box border px-2 py-4';

/** Phase-aware next step first, then the go-to shortcuts. */
function NextSteps({ quest, now }: { quest: AdminQuest; now: Date }) {
  const t = useT().admin.dashboard;
  let content;
  switch (quest.phase) {
    case 'quiz':
      content = (
        <p className="m-0 text-sm text-taupe">{t.quizOpen(formatLongDate(quest.resultsAt))}</p>
      );
      break;
    case 'finished':
      // Results are served only for the current quest, so the next edition waits for them.
      content = canStartNextEdition(quest, now) ? (
        <>
          <Button to="/admin/quest/new">{t.startNext}</Button>
          <Button to="/admin/results" variant="quiet">
            {t.viewResults}
          </Button>
        </>
      ) : (
        <p className="m-0 text-sm text-taupe">
          {t.resultsWait(formatLongDate(quest.resultsAt))}
        </p>
      );
      break;
  }

  return (
    <section className="flex flex-col gap-3 rounded-box border border-[color:var(--rule)] p-4">
      <h2 className="type-label m-0">{t.quickActions}</h2>
      {content && <div className="flex flex-wrap items-center gap-3">{content}</div>}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {QUICK_ACTIONS.map(({ to, key, icon: Icon }) =>
          to ? (
            <Link
              key={key}
              to={to}
              className={`${TILE} border-amber/60 bg-ash-hi text-amber shadow-[0_2px_0_var(--color-void)] transition hover:bg-[color:var(--color-taupe-dim)]/30 active:translate-y-px active:shadow-none`}
            >
              <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
              <span className="max-w-full truncate text-xs font-medium">{t[key]}</span>
            </Link>
          ) : (
            <div
              key={key}
              aria-disabled="true"
              className={`${TILE} border-dashed border-[color:var(--rule)] text-taupe`}
            >
              <Icon className="h-6 w-6 opacity-60" strokeWidth={1.75} aria-hidden="true" />
              <span className="max-w-full truncate text-xs font-medium">
                {t[key]}
                <span className="sr-only">{t.comingSoon}</span>
              </span>
              <span aria-hidden="true" className="type-label text-[0.5625rem]">
                {t.soon}
              </span>
            </div>
          )
        )}
      </div>
    </section>
  );
}
