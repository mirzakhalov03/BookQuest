import type { QuizAdmin, QuizOption, QuizQuestion, SaveQuizPayload } from '@bookquest/shared';

export type QuizFormState = SaveQuizPayload;

/** The saved ids and labels; the save schema insists on exactly this pair. */
export const TRUE_FALSE_OPTIONS: QuizOption[] = [
  { id: 'true', text: 'True' },
  { id: 'false', text: 'False' }
];

const newOptionId = () => crypto.randomUUID().slice(0, 8);
export const newOption = (): QuizOption => ({ id: newOptionId(), text: '' });

/** Only the save fields: the schema is strict, so server extras (`id`, `issues`…) must not leak in. */
export function toQuizFormState(quiz: QuizAdmin): QuizFormState {
  return {
    revision: quiz.revision,
    title: quiz.title,
    description: quiz.description,
    settings: quiz.settings,
    questions: quiz.questions
  };
}

export function optionsFor(type: QuizQuestion['type']): QuizQuestion['options'] {
  return type === 'true_false' ? TRUE_FALSE_OPTIONS.map((o) => ({ ...o })) : [newOption(), newOption()];
}

/** New questions copy the previous one's type and difficulty (§5.2). */
export function newQuestion(previous?: QuizQuestion): QuizQuestion {
  const type = previous?.type ?? 'mcq';
  return {
    id: newOptionId(),
    type,
    prompt: '',
    options: optionsFor(type),
    correctOptionId: null,
    timeLimitSec: null,
    difficulty: previous?.difficulty ?? 'medium',
    explanation: null
  };
}
