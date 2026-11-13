import { TRUE_FALSE_OPTION_IDS, type AttemptReview } from '@bookquest/shared';
import { Screen } from '@/components/layout/Screen';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { QuestionCard } from '@/components/quiz/QuestionCard';
import { isNotFound } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errorMessage';
import { formatStopwatch } from '@/lib/format';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useQuizReview } from './api/useQuizReview';
import { useT, type Messages } from '@/i18n';

type ReviewItem = AttemptReview['items'][number];

const chipLabel = (item: ReviewItem, t: Messages['quiz']): string =>
  item.voided ? t.voided : t.outcome[item.outcome ?? 'unserved'];

/** `/quiz/review` — own answers beside the key, read-only; opens with the results. */
export function QuizReviewPage() {
  useTelegramBackButton('/quiz');
  const t = useT();
  const { data, error, refetch } = useQuizReview();

  if (!data) {
    if (!error) return <LoadingState label={t.quiz.reviewLoading} />;
    if (isNotFound(error)) {
      return (
        <Screen>
          <EmptyState title={t.quiz.reviewUnavailableTitle} body={errorMessage(error)} />
          <Button to="/quiz" variant="quiet" className="self-center">
            {t.quiz.backToQuiz}
          </Button>
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
      <header className="flex flex-col gap-1">
        <p className="type-label">{t.quiz.yourAnswers}</p>
        <h1 className="type-display m-0 text-3xl tabular-nums text-paper">
          {data.score} / {data.total}
        </h1>
        <p className="m-0 text-taupe">{t.quiz.totalTime(formatStopwatch(data.durationMs))}</p>
      </header>
      <ol className="m-0 flex list-none flex-col gap-10 p-0">
        {data.items.map((item) => (
          <ReviewCard key={item.index} item={item} total={data.items.length} />
        ))}
      </ol>
      {/* Only reachable after results, when `/quiz` redirects to `/results` anyway. */}
      <Button to="/results" variant="quiet" className="self-center">
        {t.quiz.backToResults}
      </Button>
    </Screen>
  );
}

function ReviewCard({ item, total }: { item: ReviewItem; total: number }) {
  const t = useT().quiz;
  return (
    <li className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="type-label">{t.questionOf(item.index + 1, total)}</span>
        <span className="flex items-center gap-2 text-taupe">
          {item.elapsedMs != null && <span className="tabular-nums">{formatStopwatch(item.elapsedMs)}</span>}
          <span className="rounded-chip border border-paper/15 px-2 py-0.5 text-paper-dim">{chipLabel(item, t)}</span>
        </span>
      </div>
      <QuestionCard
        question={{ type: item.options.every((option) => (TRUE_FALSE_OPTION_IDS as readonly string[]).includes(option.id)) ? 'true_false' : 'mcq', prompt: item.prompt, options: item.options }}
        selectedOptionId={item.selectedOptionId}
        lockedOptionId={item.selectedOptionId}
        revealCorrectOptionId={item.correctOptionId}
        disabled
        onSelect={() => {}}
      />
      {item.voided && <p className="m-0 text-sm text-taupe">{t.questionVoided}</p>}
      {item.explanation && <p className="m-0 text-sm text-paper-dim">{item.explanation}</p>}
    </li>
  );
}
