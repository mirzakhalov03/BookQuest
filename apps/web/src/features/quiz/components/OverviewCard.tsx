import { useMemo, type ReactNode } from 'react';
import type { Quest, QuizOverview } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Countdown } from '@/components/ui/Countdown';
import { EmptyState } from '@/components/feedback/EmptyState';
import { formatCount, formatDuration, formatLongDate } from '@/lib/format';
import { RulesList } from './RulesSheet';
import { StartCta } from './StartCta';

interface OverviewCardProps {
  overview: QuizOverview;
  /** For the registration cut-off, which the overview doesn't carry. */
  quest: Quest | undefined;
  onRefresh: () => void;
}

/** One primary card per overview state (§4.1). `results` never gets here: the page redirects. */
export function OverviewCard({ overview, quest, onRefresh }: OverviewCardProps) {
  const { state, window: quizWindow, quiz, attempt } = overview;
  const opensAt = useMemo(() => (quizWindow ? new Date(quizWindow.opensAt) : null), [quizWindow]);

  switch (state) {
    case 'no_quest':
    case 'results':
      return <EmptyState title="No quiz scheduled" body="Check back once the next edition opens." />;

    case 'not_registered': {
      const closed = quest ? Date.now() >= Date.parse(quest.readingDeadline) : false;
      return (
        <Card label="Quiz" title={closed ? 'Registration closed' : 'Register to take part'}>
          {quizWindow && <p className="m-0 text-paper-dim">The quiz opens {formatLongDate(quizWindow.opensAt)}.</p>}
          {closed ? (
            <p className="m-0 text-taupe">Registration for this edition has ended. See you at the next one.</p>
          ) : (
            <Button to="/me" className="self-center">
              Register to take part
            </Button>
          )}
        </Card>
      );
    }

    case 'not_configured':
      return (
        <Card label="Quiz" title="Questions are being prepared">
          {opensAt && <Countdown label="Quiz opens in" target={opensAt} dateText={formatLongDate(opensAt)} onComplete={onRefresh} />}
        </Card>
      );

    case 'upcoming':
      return (
        <Card label="Quiz" title={quiz?.title ?? 'Quiz day is coming'}>
          {quiz?.description && <p className="m-0 max-w-prose text-paper-dim">{quiz.description}</p>}
          {opensAt && <Countdown label="Quiz opens in" target={opensAt} dateText={formatLongDate(opensAt)} onComplete={onRefresh} />}
          {quiz && <QuizFacts quiz={quiz} />}
          <RulesCard quiz={quiz} />
        </Card>
      );

    case 'open':
      return (
        <Card label="Quiz" title={quiz?.title ?? 'The quiz'}>
          {quiz?.description && <p className="m-0 max-w-prose text-paper-dim">{quiz.description}</p>}
          {quizWindow && <StartCta window={quizWindow} quiz={quiz} onWindowChange={onRefresh} />}
          <RulesCard quiz={quiz} />
        </Card>
      );

    case 'in_progress':
      return (
        <Card label="Quiz in progress" title="Continue quiz">
          {attempt && (
            <p className="m-0 text-paper-dim">
              {formatCount(attempt.answered)} of {formatCount(attempt.total)} answered
            </p>
          )}
          <Button to="/quiz/play" className="self-center">
            Continue quiz
          </Button>
        </Card>
      );

    case 'completed':
      return (
        <Card label="Quiz complete" title="Done!">
          <p className="m-0 text-paper-dim">Your answers are in. Scores stay sealed until results are announced.</p>
          {quizWindow && <p className="m-0 text-taupe">Results on {formatLongDate(quizWindow.resultsAt)}.</p>}
          {attempt?.reviewAvailable && (
            <Button to="/quiz/review" variant="quiet" className="self-center">
              Review answers
            </Button>
          )}
        </Card>
      );

    case 'missed':
      return (
        <Card label="Quiz" title="The quiz has closed.">
          {quizWindow && <p className="m-0 text-taupe">Results on {formatLongDate(quizWindow.resultsAt)}.</p>}
        </Card>
      );

    case 'voided':
      return (
        <Card label="Quiz" title="Attempt withdrawn">
          <p className="m-0 text-paper-dim">Your attempt was withdrawn by the organisers.</p>
          {attempt?.voidReason && <p className="m-0 text-taupe">Reason: {attempt.voidReason}</p>}
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

function QuizFacts({ quiz }: { quiz: NonNullable<QuizOverview['quiz']> }) {
  return (
    <p className="m-0 text-paper-dim">
      {formatCount(quiz.questionCount)} questions · {formatDuration(quiz.totalSeconds * 1000)} in total
    </p>
  );
}

function RulesCard({ quiz }: { quiz: QuizOverview['quiz'] }) {
  return (
    <div className="rounded-box border border-paper/10 bg-ash/60 p-4 text-left">
      <p className="type-label mb-3">How it works</p>
      <RulesList quiz={quiz} />
    </div>
  );
}
