import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ATTEMPT_STATUSES, QUIZ_FLAGS, QUIZ_RESCORE_FREEZE_MS, type AttemptRow, type AttemptStatus, type QuizFlag } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { SearchInput } from '@/components/ui/SearchInput';
import { Select } from '@/components/ui/Select';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { useCurrentQuest } from '@/lib/api/quest';
import { formatCount, formatParticipantNumber } from '@/lib/format';
import { useQuizAttempts, useQuizLive, type AttemptFilters } from '../api/useQuizLive';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQuery } from '../components/AdminQuery';
import { AttemptSheet } from './components/AttemptSheet';
import { AttemptsTable } from './components/AttemptsTable';
import { LiveGroupTiles } from './components/LiveGroupTiles';
import { VoidAttemptSheet } from './components/VoidAttemptSheet';
import { useT } from '@/i18n';

const SEARCH_DEBOUNCE_MS = 350;


const pick = <T extends string>(value: string | null, allowed: readonly T[]): T | '' =>
  value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : '';

/** `/admin/quizzes/live` — per-variant progress and every attempt, polled while the tab is visible. */
export function QuizLivePage() {
  const live = useQuizLive();
  const t = useT().adminQuiz.live;

  return (
    <AdminScreen className="max-w-5xl">
      <AdminPageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        actions={
          <Button to="/admin/quizzes" variant="quiet" className="min-h-11 px-4">
            {t.library}
          </Button>
        }
      />
      <AdminQuery query={live} loadingLabel={t.loading}>
        {(stats) =>
          stats.groups.length === 0 ? (
            <EmptyState
              titleAs="h2"
              title={t.noneTitle}
              body={t.noneBody}
              className="flex-1"
            />
          ) : (
            <>
              <LiveGroupTiles groups={stats.groups} />
              <Attempts />
            </>
          )
        }
      </AdminQuery>
    </AdminScreen>
  );
}

/** Filters live in the URL so a refresh, a shared link or Back keeps them. */
function Attempts() {
  const [params, setParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(() => params.get('q') ?? '');
  const { common, adminQuiz } = useT();
  const t = adminQuiz.live;
  const statusOptions = [
    { value: '' as const, label: t.anyStatus },
    ...ATTEMPT_STATUSES.map((value) => ({ value, label: adminQuiz.status[value] }))
  ];
  const flagOptions = [
    { value: '' as const, label: t.anyFlag },
    ...QUIZ_FLAGS.map((value) => ({ value, label: adminQuiz.flags[value] }))
  ];
  const q = useDebouncedValue(searchInput.trim(), SEARCH_DEBOUNCE_MS);
  const filters: AttemptFilters = {
    status: pick<AttemptStatus>(params.get('status'), ATTEMPT_STATUSES),
    flag: pick<QuizFlag>(params.get('flag'), QUIZ_FLAGS),
    q
  };

  const attempts = useQuizAttempts(filters);
  const quest = useCurrentQuest();
  const [open, setOpen] = useState<AttemptRow | null>(null);
  const [voiding, setVoiding] = useState(false);
  // The server enforces it too (incl. the last-minute freeze); this only hides a button that would 409.
  const canVoid = quest.data !== undefined && Date.now() < Date.parse(quest.data.resultsAt) - QUIZ_RESCORE_FREEZE_MS;

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true }
    );
  }

  // The box is local until debounced, so typing never waits on the URL.
  useEffect(() => setParam('q', q), [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const items = attempts.data?.pages.flatMap((page) => page.items) ?? [];
  const total = attempts.data?.pages[0]?.total ?? 0;
  const filtered = filters.status !== '' || filters.flag !== '' || q !== '';
  const who = open ? `#${formatParticipantNumber(open.participant.number)} ${open.participant.fullName}` : '';

  return (
    <section className="flex flex-col gap-4">
      <h2 className="type-label m-0">{t.attempts}</h2>
      <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap sm:items-end">
        <SearchInput
          aria-label={t.searchAria}
          placeholder={t.searchPlaceholder}
          maxLength={80}
          value={searchInput}
          onChange={setSearchInput}
          className="col-span-2 w-full sm:max-w-xs"
        />
        <Select<AttemptStatus | ''>
          label={t.statusLabel}
          value={filters.status}
          options={statusOptions}
          onChange={(status) => setParam('status', status)}
        />
        <Select<QuizFlag | ''> label={t.flagLabel} value={filters.flag} options={flagOptions} onChange={(flag) => setParam('flag', flag)} />
      </div>

      <AdminQuery query={attempts} loadingLabel={t.attemptsLoading}>
        {() =>
          items.length === 0 ? (
            <EmptyState
              titleAs="h2"
              title={filtered ? t.noMatch : t.noneStarted}
              body={filtered ? t.clearFilter : t.appearHere}
            />
          ) : (
            <div className={`flex flex-col gap-4 transition-opacity ${attempts.isPlaceholderData ? 'opacity-60' : ''}`}>
              <p className="m-0 text-sm text-taupe">{t.count(total, formatCount(total))}</p>
              <AttemptsTable attempts={items} onOpen={setOpen} />
              {attempts.hasNextPage && (
                <Button
                  variant="quiet"
                  className="self-center"
                  disabled={attempts.isFetchingNextPage}
                  onClick={() => void attempts.fetchNextPage()}
                >
                  {attempts.isFetchingNextPage ? common.loading : t.showMore(formatCount(total - items.length))}
                </Button>
              )}
            </div>
          )
        }
      </AdminQuery>

      <AttemptSheet
        id={open?.id ?? null}
        who={who}
        canVoid={canVoid}
        onClose={() => setOpen(null)}
        onVoid={() => setVoiding(true)}
      />
      {open && (
        <VoidAttemptSheet
          attemptId={open.id}
          who={who}
          open={voiding}
          onClose={() => setVoiding(false)}
          onVoided={() => setOpen(null)}
        />
      )}
    </section>
  );
}
