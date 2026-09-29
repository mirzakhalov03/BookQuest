import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Quest } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCount, formatLongDate } from '@/lib/format';
import { useAdminStats } from './api/useAdminStats';
import { AdminQuery } from './components/AdminQuery';
import { AdminPageHeader } from './components/AdminPageHeader';
import { ForbiddenState, isForbidden } from './components/ForbiddenState';
import { QuestTimeline } from './components/QuestTimeline';
import { PHASE_LABEL, canStartNextEdition, nextMilestone, type Milestone } from './phase';
import { questDates } from './dates';
import { broadcastSuggestions } from './broadcast/suggestions';
import type { BroadcastLocationState } from './broadcast/BroadcastPage';

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

function Dashboard({ quest }: { quest: Quest }) {
  const stats = useAdminStats();
  const [now] = useState(() => new Date());
  const milestone = nextMilestone(quest, now);
  // Quest is public; only the stats call tells us the viewer isn't an admin.
  if (isForbidden(stats.error)) return <ForbiddenState error={stats.error} />;

  const count = (value: number | undefined) => (value === undefined ? '—' : formatCount(value));

  return (
    <AdminScreen>
      <AdminPageHeader
        eyebrow={`Edition ${quest.edition}`}
        title={quest.book.title}
        actions={
          <span className="type-label rounded-chip border border-[color:var(--rule-strong)] px-2 py-1 text-paper-dim">
            {PHASE_LABEL[quest.phase]}
          </span>
        }
      />

      {milestone && <MilestoneLine milestone={milestone} />}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="Participants" value={count(stats.data?.participants)} />
        <StatCard label="Joined today" value={count(stats.data?.registeredToday)} />
        <StatCard label="Quiz submitted" value={count(stats.data?.quizSubmitted)} />
      </div>

      <NextSteps quest={quest} now={now} />

      <section className="flex flex-col gap-2">
        <h2 className="type-label m-0">Schedule</h2>
        <QuestTimeline
          dates={questDates(quest)}
          now={now}
          renderValue={(field) => <span className="text-paper-dim">{formatLongDate(quest[field])}</span>}
        />
      </section>
    </AdminScreen>
  );
}

function MilestoneLine({ milestone }: { milestone: Milestone }) {
  // Memoised on the ISO string: a fresh Date each render would restart useCountdown's tick.
  const target = useMemo(() => new Date(milestone.at), [milestone.at]);
  const { days, hours } = useCountdown(target);
  // Worded from time remaining: days === 0 spans 24h, so it can't say "today" honestly.
  let when: string;
  if (target.getTime() <= Date.now()) when = 'now';
  else if (days >= 1) when = `in ${days} ${days === 1 ? 'day' : 'days'}`;
  else if (hours >= 1) when = `in ${hours} h`;
  else when = 'within the hour';

  return (
    <p className="m-0 text-paper">
      {milestone.label} {when}
      <span className="text-taupe"> · {formatLongDate(milestone.at)}</span>
    </p>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-1 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] px-3 py-3">
      <p className="type-label m-0 break-words">{label}</p>
      <p className="type-display m-0 tabular-nums text-2xl text-paper">{value}</p>
    </div>
  );
}

/** Phase-aware actions only — the tab bar already covers plain navigation. */
function NextSteps({ quest, now }: { quest: Quest; now: Date }) {
  const navigate = useNavigate();
  const [suggestion] = broadcastSuggestions(quest, now);
  const draft = (message: string) =>
    navigate('/admin/broadcast', { state: { draft: message } satisfies BroadcastLocationState });

  let content;
  switch (quest.phase) {
    case 'upcoming':
    case 'reading':
      content = suggestion && <Button onClick={() => draft(suggestion.message)}>{suggestion.label}</Button>;
      break;
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
      <h2 className="type-label m-0">What's next</h2>
      <div className="flex flex-wrap items-center gap-3">{content}</div>
    </section>
  );
}
