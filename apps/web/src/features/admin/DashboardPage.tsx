import { useState, type CSSProperties } from 'react';
import { Link } from 'react-router';
import { Award, CircleHelp, Image, type LucideIcon } from 'lucide-react';
import type { Quest } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { BookCover } from '@/components/BookCover';
import { Button } from '@/components/ui/Button';
import { formatCount, formatLongDate } from '@/lib/format';
import { useAdminStats } from './api/useAdminStats';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { ForbiddenState, isForbidden } from './components/ForbiddenState';
import { canStartNextEdition } from './phase';

/** `/admin` — where the quest stands and the one or two things worth doing about it. */
export function DashboardPage() {
  const quest = useCurrentQuest();

  return (
    <AdminQuery
      query={quest}
      loadingLabel="Reading the register…"
      notFound={(error) => (
        <EmptyState
          title={error.message}
          body="Nothing is running between editions. Set up the next one when you're ready."
          action={<Button to="/admin/quest/new">Start next edition</Button>}
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

function Dashboard({ quest }: { quest: Quest }) {
  const stats = useAdminStats();
  const [now] = useState(() => new Date());
  // Quest is public; only the stats call tells us the viewer isn't an admin.
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

      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        <StatCard label="Participants" value={count(stats.data?.participants)} />
        <StatCard label="Joined today" value={count(stats.data?.registeredToday)} />
        <StatCard label="Quiz submitted" value={count(stats.data?.quizSubmitted)} />
      </div>

      <NextSteps quest={quest} now={now} />

    </AdminScreen>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] px-2.5 py-3 sm:px-3">
      <p className="type-label m-0 truncate text-[0.5625rem] tracking-[0.06em] sm:text-[0.6875rem] sm:tracking-[var(--tracking-label)]">
        {label}
      </p>
      <p className="type-display m-0 tabular-nums text-xl text-paper sm:text-2xl">{value}</p>
    </div>
  );
}

// Placeholder destinations: each gets its own admin page later.
const QUICK_ACTIONS: { to: string; label: string; icon: LucideIcon }[] = [
  { to: '/admin/quizzes', label: 'Quizzes', icon: CircleHelp },
  { to: '/admin/certificates', label: 'Certificates', icon: Award },
  { to: '/admin/posters', label: 'Posters', icon: Image },
];

/** Phase-aware next step first, then the go-to shortcuts. */
function NextSteps({ quest, now }: { quest: Quest; now: Date }) {
  let content;
  switch (quest.phase) {
    case 'quiz':
      content = (
        <p className="m-0 text-sm text-taupe">The quiz is open. Results go out {formatLongDate(quest.resultsAt)}.</p>
      );
      break;
    case 'finished':
      // Results are served only for the current quest, so the next edition waits for them.
      content = canStartNextEdition(quest, now) ? (
        <>
          <Button to="/admin/quest/new">Start next edition</Button>
          <Button to="/admin/results" variant="quiet">
            View results
          </Button>
        </>
      ) : (
        <p className="m-0 text-sm text-taupe">
          Results go out {formatLongDate(quest.resultsAt)}. The next edition can start after that.
        </p>
      );
      break;
  }

  return (
    <section className="flex flex-col gap-3 rounded-box border border-[color:var(--rule)] p-4">
      <h2 className="type-label m-0">Quick actions</h2>
      {content && <div className="flex flex-wrap items-center gap-3">{content}</div>}
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {QUICK_ACTIONS.map(({ to, label, icon: Icon }) => (
          <Link
            key={to}
            to={to}
            className="flex min-w-0 flex-col items-center gap-2 rounded-box border border-amber/60 bg-ash-hi px-2 py-4 text-amber shadow-[0_2px_0_var(--color-void)] transition hover:bg-[color:var(--color-taupe-dim)]/30 active:translate-y-px active:shadow-none"
          >
            <Icon className="h-6 w-6" strokeWidth={1.75} aria-hidden="true" />
            <span className="max-w-full truncate text-xs font-medium">{label}</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
