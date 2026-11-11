import { QUIZ_RESULTS_BUFFER_MS, sameShape, type QuizShape, type QuizSummaryAdmin } from '@bookquest/shared';
import { formatQuizDuration } from '../quizzes/format';
import type { QuizConfigForm } from './quizConfig';

export interface FixLink {
  label: string;
  /** A route for a quiz editor; otherwise the checklist jumps to a tab. */
  to?: string;
  tab?: 'dates';
}

export interface ReadinessCheck {
  id: 'ready' | 'shape' | 'buffer' | 'window';
  label: string;
  ok: boolean;
  detail: string | null;
  fixes: FixLink[];
}

interface ReadinessInput {
  config: QuizConfigForm;
  groupLabels: string[];
  quizzes: QuizSummaryAdmin[];
  quizOpensAt: Date | null;
  quizClosesAt: Date | null;
  resultsAt: Date | null;
}

const shapeOf = (quiz: QuizSummaryAdmin): QuizShape => ({
  questionCount: quiz.questionCount,
  totalSeconds: quiz.totalSeconds,
  difficulty: quiz.difficultyMix
});

const editorLink = (quiz: QuizSummaryAdmin, verb = 'Edit'): FixLink => ({
  label: `${verb} “${quiz.title}”`,
  to: `/admin/quizzes/${quiz.id}`
});

/** The four §5.3 checks, client-side; the server re-runs them on save and stays the authority. */
export function checkReadiness(input: ReadinessInput): ReadinessCheck[] {
  const { config, groupLabels, quizzes, quizOpensAt, quizClosesAt, resultsAt } = input;
  const picked = config.quizIds.map((id) => quizzes.find((quiz) => quiz.id === id) ?? null);
  const chosen = picked.filter((quiz): quiz is QuizSummaryAdmin => quiz !== null);

  const notReady = picked.flatMap((quiz, i) => (quiz?.isComplete ? [] : [{ quiz, label: groupLabels[i] ?? '' }]));
  const ready: ReadinessCheck = {
    id: 'ready',
    label: 'Every group has a ready quiz',
    ok: notReady.length === 0,
    detail: notReady.length === 0 ? null : `Needs attention: ${notReady.map((item) => item.label).join(', ')}.`,
    fixes: notReady.flatMap(({ quiz }) => (quiz ? [editorLink(quiz, 'Finish')] : []))
  };

  const [first, ...rest] = chosen;
  const mismatch = first !== undefined && rest.some((quiz) => !sameShape(shapeOf(first), shapeOf(quiz)));
  const shape: ReadinessCheck = {
    id: 'shape',
    label: 'Variants match in shape',
    ok: !mismatch,
    detail: mismatch
      ? chosen
          .map((quiz) => `“${quiz.title}”: ${quiz.questionCount} questions, ${formatQuizDuration(quiz.totalSeconds)}`)
          .join(' · ') + '. Same question count, difficulty mix and total time are required.'
      : null,
    fixes: mismatch ? chosen.map((quiz) => editorLink(quiz)) : []
  };

  const bufferMinutes = QUIZ_RESULTS_BUFFER_MS / 60_000;
  const bufferOk = !quizClosesAt || !resultsAt || resultsAt.getTime() >= quizClosesAt.getTime() + QUIZ_RESULTS_BUFFER_MS;
  const buffer: ReadinessCheck = {
    id: 'buffer',
    label: `Results come ${bufferMinutes} min or more after the quiz closes`,
    ok: bufferOk,
    detail: bufferOk ? null : 'Late attempts need time to finish before ranking.',
    fixes: bufferOk ? [] : [{ label: 'Change the dates', tab: 'dates' }]
  };

  const windowMs = quizOpensAt && quizClosesAt ? quizClosesAt.getTime() - quizOpensAt.getTime() : null;
  const needed = first ? shapeOf(first).totalSeconds * 1000 : null;
  const windowOk = windowMs === null || needed === null || windowMs >= needed;
  const window: ReadinessCheck = {
    id: 'window',
    label: 'The quiz window fits the quiz',
    ok: windowOk,
    detail:
      windowOk || windowMs === null || needed === null
        ? null
        : `The window is ${formatQuizDuration(Math.max(0, Math.floor(windowMs / 1000)))} but the quiz takes ${formatQuizDuration(needed / 1000)}.`,
    fixes: windowOk ? [] : [{ label: 'Change the dates', tab: 'dates' }]
  };

  return [ready, shape, buffer, window];
}

/** Quizzes a group can pick: ready ones that are free or already on this edition (plus any current pick, so it stays visible). */
export function pickableQuizzes(quizzes: QuizSummaryAdmin[], edition: number, selected: string[]): QuizSummaryAdmin[] {
  return quizzes.filter(
    (quiz) =>
      selected.includes(quiz.id) ||
      (quiz.isComplete && (quiz.attachment === null || quiz.attachment.questEdition === edition))
  );
}
