import type { ReactNode } from 'react';
import { useNavigate } from 'react-router';
import type { Quest } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { useAuth } from '@/lib/auth/useAuth';
import { haptic } from '@/lib/telegram';
import { formatCount, formatParticipantNumber } from '@/lib/format';
import { useT, type Messages } from '@/i18n';

interface QuestActionProps {
  quest: Quest;
}

/**
 * The one primary button and its sub-line (spec §4). Chosen from
 * `quest.phase` and whether the viewer has registered — both rendered
 * straight off the API, never derived here (rule 4).
 */
export function QuestAction({ quest }: QuestActionProps) {
  const { user } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const participant = user?.participant ?? null;

  const go = (path: string) => {
    haptic('action');
    navigate(path);
  };

  // The gold "finished" row outranks registration entirely: everyone,
  // registered or not, gets the same button once there is a result to see.
  if (quest.phase === 'finished') {
    return (
      <Act>
        <PrimaryButton variant="gold" onClick={() => go('/results')}>
          {t.home.viewResults}
        </PrimaryButton>
        <p className="act__sub">{t.home.certificatesOnTheWay}</p>
      </Act>
    );
  }

  if (participant) {
    if (quest.phase === 'quiz') {
      return (
        <Act>
          {/* `/quiz` is a countdown placeholder until the quiz is built (plan Phase 6). */}
          <PrimaryButton onClick={() => go('/quiz')}>{t.home.enterQuiz}</PrimaryButton>
          <p className="act__sub">{quizSubline(quest.quiz, t)}</p>
        </Act>
      );
    }

    // `upcoming` and `reading` read the same way here: registration is open
    // in both (TBD-2 closes it at `readingDeadline`), and there is nothing
    // else for an already-registered reader to do but head for the book.
    return (
      <Act>
        <PrimaryButton onClick={() => go('/book')}>{t.home.goToBook}</PrimaryButton>
        <p className="act__sub">{t.home.youAreParticipant(formatParticipantNumber(participant.number))}</p>
      </Act>
    );
  }

  // Not registered, and the reading window — the only time joining is
  // possible (TBD-2 resolved) — has closed.
  if (quest.phase === 'quiz') {
    return (
      <Act>
        <Button variant="quiet" disabled>
          {t.home.registrationClosed}
        </Button>
        <p className="act__sub">{t.home.registrationClosedSub}</p>
      </Act>
    );
  }

  // Not registered, registration still open. `/me` handles signing in first when needed.
  return (
    <Act>
      <PrimaryButton onClick={() => go('/me')}>{t.home.join}</PrimaryButton>
      <p className="act__sub">{t.home.joinSub}</p>
    </Act>
  );
}

function quizSubline(quiz: Quest['quiz'], t: Messages): string {
  // Null until an admin attaches a quiz.
  if (!quiz) return t.home.speedCounts;
  const minutes = Math.max(1, Math.round(quiz.totalSeconds / 60));
  return t.home.quizSummary(t.common.questions(quiz.questionCount, formatCount(quiz.questionCount)), minutes);
}

function Act({ children }: { children: ReactNode }) {
  return <div className="act">{children}</div>;
}

function PrimaryButton({
  variant = 'primary',
  onClick,
  children
}: {
  variant?: 'primary' | 'gold';
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    // The prototype's `.btn--wide { width: min(100%, 22rem) }` — full width on
    // a narrow phone, capped once `.act` (100% of the unconstrained `.home`)
    // gets wide enough that an edge-to-edge button would look like a banner.
    <Button variant={variant} className="group w-full max-w-[22rem]" onClick={onClick}>
      <span>{children}</span>
      <ArrowIcon />
    </Button>
  );
}
