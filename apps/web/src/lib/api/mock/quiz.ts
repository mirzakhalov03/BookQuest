import {
  findQuizIssues,
  quizShape,
  type CreateQuizPayload,
  type QuizAdmin,
  type QuizSummaryAdmin,
  type SaveQuizPayload
} from '@bookquest/shared';
import { objectId } from './fixtures';
import { getState, updateState } from './store';

/**
 * The admin quiz library, served locally with the API's rules: revision checks
 * (stale → 409), locked and attached guards, and the same completeness helper.
 * Lives in the mock state so a reload keeps your edits, like everything else here.
 */

export class QuizFailure extends Error {
  constructor(
    readonly status: number,
    readonly code: 'not_found' | 'conflict' | 'validation_failed',
    message: string,
    readonly reason?: string,
    readonly fields?: Record<string, string>
  ) {
    super(message);
  }
}

const DEFAULT_SETTINGS = { shuffleQuestions: true, shuffleOptions: true, defaultTimeLimitSec: 30 };
const TF = [
  { id: 'true', text: 'True' },
  { id: 'false', text: 'False' }
];

function blank(id: string, title: string, content: Pick<QuizAdmin, 'description' | 'questions'>): QuizAdmin {
  return {
    id,
    title,
    description: content.description,
    settings: { ...DEFAULT_SETTINGS },
    questions: content.questions,
    revision: 0,
    issues: null,
    locked: false,
    attachment: null,
    usedIn: [],
    corrections: [],
    voidedQuestionIds: [],
    updatedAt: new Date().toISOString()
  };
}

function seed(): QuizAdmin[] {
  const ready = blank(objectId('quiz:ready'), 'Chapters 1–3 warm-up', {
    description: 'A short check on the opening chapters.',
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        prompt: 'Who opens the story?',
        options: [
          { id: 'a', text: 'The narrator' },
          { id: 'b', text: 'The captain' },
          { id: 'c', text: 'The cook' }
        ],
        correctOptionId: 'a',
        timeLimitSec: null,
        difficulty: 'easy',
        explanation: null
      },
      {
        id: 'q2',
        type: 'true_false',
        prompt: 'The book is set entirely at sea.',
        options: TF,
        correctOptionId: 'false',
        timeLimitSec: 20,
        difficulty: 'medium',
        explanation: 'Part two moves ashore.'
      }
    ]
  });
  const draft = blank(objectId('quiz:draft'), 'Draft: themes', {
    description: null,
    questions: [
      {
        id: 'q1',
        type: 'mcq',
        prompt: '',
        options: [
          { id: 'a', text: '' },
          { id: 'b', text: '' }
        ],
        correctOptionId: null,
        timeLimitSec: null,
        difficulty: 'medium',
        explanation: null
      }
    ]
  });
  return [ready, draft].map(withIssues);
}

const withIssues = (quiz: QuizAdmin): QuizAdmin => ({ ...quiz, issues: findQuizIssues(quiz) });

function library(): QuizAdmin[] {
  const state = getState();
  if (!state.quizzes) updateState((draft) => void (draft.quizzes = seed()));
  return getState().quizzes ?? [];
}

function write(mutate: (quizzes: QuizAdmin[]) => QuizAdmin[]): void {
  updateState((draft) => void (draft.quizzes = mutate(draft.quizzes ?? [])));
}

function find(id: string): QuizAdmin {
  const quiz = library().find((entry) => entry.id === id);
  if (!quiz) throw new QuizFailure(404, 'not_found', 'No such quiz.');
  return quiz;
}

function summarise(quiz: QuizAdmin): QuizSummaryAdmin {
  const shape = quizShape(quiz);
  return {
    id: quiz.id,
    title: quiz.title,
    questionCount: shape.questionCount,
    totalSeconds: shape.totalSeconds,
    difficultyMix: shape.difficulty,
    isComplete: quiz.issues === null,
    issueCount: Object.keys(quiz.issues ?? {}).length,
    attachment: quiz.attachment,
    locked: quiz.locked,
    revision: quiz.revision,
    updatedAt: quiz.updatedAt
  };
}

export const listQuizzes = (): QuizSummaryAdmin[] =>
  [...library()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(summarise);

export const getQuiz = (id: string): QuizAdmin => find(id);

export function createQuiz(payload: CreateQuizPayload): QuizAdmin {
  const quiz = withIssues(blank(objectId(`quiz:${crypto.randomUUID()}`), payload.title, { description: payload.description, questions: [] }));
  write((all) => [quiz, ...all]);
  return quiz;
}

export function saveQuiz(id: string, payload: SaveQuizPayload): QuizAdmin {
  const current = find(id);
  if (payload.revision !== current.revision) {
    throw new QuizFailure(409, 'conflict', 'Someone else saved this quiz. Reload to see their version.', 'stale');
  }
  if (current.locked) {
    throw new QuizFailure(409, 'conflict', 'Participants have started this quiz, so it can no longer be edited.', 'quiz_locked');
  }
  const issues = findQuizIssues(payload);
  if (current.attachment && issues) {
    throw new QuizFailure(400, 'validation_failed', 'This quiz is attached to a quest, so it has to be complete.', undefined, issues);
  }
  const saved: QuizAdmin = {
    ...current,
    title: payload.title,
    description: payload.description,
    settings: payload.settings,
    questions: payload.questions,
    issues,
    revision: current.revision + 1,
    updatedAt: new Date().toISOString()
  };
  write((all) => all.map((entry) => (entry.id === id ? saved : entry)));
  return saved;
}

export function duplicateQuiz(id: string): QuizAdmin {
  const source = find(id);
  const copy: QuizAdmin = {
    ...source,
    id: objectId(`quiz:${crypto.randomUUID()}`),
    title: `${source.title} (copy)`.slice(0, 120),
    revision: 0,
    locked: false,
    attachment: null,
    usedIn: [],
    corrections: [],
    voidedQuestionIds: [],
    updatedAt: new Date().toISOString()
  };
  write((all) => [copy, ...all]);
  return copy;
}

export function deleteQuiz(id: string): void {
  const quiz = find(id);
  if (quiz.attachment || quiz.locked) {
    throw new QuizFailure(409, 'conflict', 'This quiz is in use, so it can’t be deleted.', 'quiz_locked');
  }
  write((all) => all.filter((entry) => entry.id !== id));
}
