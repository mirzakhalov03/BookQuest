import { useMemo } from 'react';
import { useCurrentQuest } from './api/useCurrentQuest';
import { useCountdown } from '@/hooks/useCountdown';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { Screen } from '@/components/layout/Screen';
import { TopBar } from '@/components/layout/TopBar';

/**
 * Stub. The finished composition lives in /prototype/index.html — the 3D book
 * stage, spotlight, podium and countdown are ported into components here.
 */
export function HomePage() {
  const { data: quest, isPending, error, refetch } = useCurrentQuest();
  // Memoised on the ISO string, not recreated every render — a fresh Date
  // instance each render would change useCountdown's effect dependency every
  // time, re-firing the effect and looping (setTime -> render -> new Date -> ...).
  const deadline = useMemo(
    () => (quest ? new Date(quest.readingDeadline) : null),
    [quest?.readingDeadline]
  );
  const time = useCountdown(deadline);

  if (isPending) return <LoadingState label="Setting the stage…" />;
  if (error) return <ErrorState error={error} onRetry={() => refetch()} />;

  return (
    <>
      <TopBar year={quest.year} />
      <Screen className="items-center justify-center gap-8 text-center">
        <div>
          <p className="type-label">On the stage</p>
          <h1 className="type-display mt-2 text-4xl">{quest.book.title}</h1>
          <p className="mt-1 text-sm text-taupe">{quest.book.author}</p>
        </div>

        <div>
          <p className="type-label text-amber">Reading deadline</p>
          <p className="type-display mt-2 text-5xl tabular-nums">
            {time.days} : {String(time.hours).padStart(2, '0')} :{' '}
            {String(time.minutes).padStart(2, '0')} : {String(time.seconds).padStart(2, '0')}
          </p>
        </div>
      </Screen>
    </>
  );
}
