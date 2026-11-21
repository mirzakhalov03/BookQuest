import { useMemo, type ReactNode } from 'react';
import type { Quest, QuizOverview } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatCount, formatLongDate } from '@/lib/format';
import { useT } from '@/i18n';
import { RulesCard } from './RulesSheet';
import { StartCta } from './StartCta';
import { CompletionScreen } from './CompletionScreen';

interface OverviewCardProps {
  overview: QuizOverview;
  /** For the registration cut-off, which the overview doesn't carry. */
  quest: Quest | undefined;
  onRefresh: () => void;
}

/** One primary card per overview state (§4.1). `results` never gets here: the page redirects. */
export function OverviewCard({ overview, quest, onRefresh }: OverviewCardProps) {
  const t = useT();
  const q = t.quiz;
  const { state, window: quizWindow, quiz, attempt } = overview;
  const opensAt = useMemo(() => (quizWindow ? new Date(quizWindow.opensAt) : null), [quizWindow]);

  switch (state) {
    case 'no_quest':
    case 'results':
      return <EmptyState title={q.noQuizTitle} body={t.common.checkBackNextEdition} />;

    case 'not_registered': {
      const closed = quest ? Date.now() >= Date.parse(quest.readingDeadline) : false;
      return (
        <Card label={q.label} title={closed ? q.registrationClosedTitle : q.registerTitle}>
          {quizWindow && <p className="m-0 text-paper-dim">{q.quizOpensOn(formatLongDate(quizWindow.opensAt))}</p>}
          {closed ? (
            <p className="m-0 text-taupe">{q.registrationEnded}</p>
          ) : (
            <Button to="/me" className="self-center">
              {q.registerTitle}
            </Button>
          )}
        </Card>
      );
    }

    // Before quiz day: only when it opens and how it works. The quiz itself stays a surprise.
    case 'not_configured':
    case 'upcoming':
      return (
        <Card label={q.label} title={q.comingTitle}>
          {opensAt && <Countdown label={q.opensIn} target={opensAt} dateText={formatLongDate(opensAt)} onComplete={onRefresh} />}
          <RulesCard />
        </Card>
      );

    case 'open':
      return (
        <Card label={q.label} title={quiz?.title ?? q.theQuiz}>
          {quiz?.description && <p className="m-0 max-w-prose text-paper-dim">{quiz.description}</p>}
          {quizWindow && <StartCta window={quizWindow} quiz={quiz} onWindowChange={onRefresh} />}
          <RulesCard />
        </Card>
      );

    case 'in_progress':
      return (
        <Card label={q.inProgressLabel} title={q.continueQuiz}>
          {attempt && (
            <p className="m-0 text-paper-dim">{q.answeredOf(formatCount(attempt.answered), formatCount(attempt.total))}</p>
          )}
          <Button to="/quiz/play" className="self-center">
            {q.continueQuiz}
          </Button>
        </Card>
      );

    case 'completed':
      return <CompletionScreen resultsAt={quizWindow?.resultsAt ?? null} reviewAvailable={attempt?.reviewAvailable} />;

    case 'missed':
      return (
        <Card label={q.label} title={q.closedTitle}>
          {quizWindow && <p className="m-0 text-taupe">{q.resultsOnDate(formatLongDate(quizWindow.resultsAt))}</p>}
        </Card>
      );

    case 'voided':
      return (
        <Card label={q.label} title={q.withdrawnTitle}>
          <p className="m-0 text-paper-dim">{q.withdrawnBody}</p>
          {attempt?.voidReason && <p className="m-0 text-taupe">{q.withdrawnReason(attempt.voidReason)}</p>}
        </Card>
      );
  }
}

function Card({ label, title, children }: { label: string; title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col items-stretch gap-5 text-center">
      <header className="flex flex-col gap-1">
        <p className="type-label">{label}</p>
        <h1 className="type-display m-0 text-3xl text-paper">{title}</h1>
      </header>
      {children}
    </section>
  );
}
