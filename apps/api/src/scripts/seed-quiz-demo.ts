/**
 * Dev only: one hand-written 10-question quiz attached to the current quest
 * (single group), for clicking through the participant flow. Mixes MCQ (2–6
 * options) and true/false, short and long prompts, varied timers and
 * explanations. Safe to re-run until someone starts; then the setup is locked.
 *
 *   pnpm --filter @bookquest/api seed:quiz:demo            # attach only
 *   pnpm --filter @bookquest/api seed:quiz:demo -- --open  # also open the quiz window now
 *   pnpm --filter @bookquest/api seed:quiz:demo -- --open=10  # open in 10 min; registration stays open until then
 */
import { TRUE_FALSE_OPTION_IDS, findQuizIssues, type QuestionDifficulty } from '@bookquest/shared';
import { connectToDatabase, disconnectFromDatabase } from '../db/connect.js';
import { QuestModel } from '../models/quest.model.js';
import { QuizModel } from '../models/quiz.model.js';
import { UserModel } from '../models/user.model.js';
import { buildQuizConfig, questHasAttempts } from '../services/quiz-config.services.js';
import { logger } from '../config/logger.js';

const TITLE = 'Demo quiz — classics sampler';
const DEFAULT_TIME_LIMIT_SEC = 30;
const OPEN_FOR_MS = 3 * 60 * 60 * 1000;
const RESULTS_AFTER_CLOSE_MS = 10 * 60 * 1000;

type Seed = {
  prompt: string;
  options: string[] | 'tf';
  correct: number | boolean;
  timeLimitSec: number | null;
  difficulty: QuestionDifficulty;
  explanation: string | null;
};

const QUESTIONS: Seed[] = [
  {
    prompt: 'Who wrote “1984”?',
    options: ['George Orwell', 'Aldous Huxley', 'Ray Bradbury', 'H. G. Wells'],
    correct: 0,
    timeLimitSec: 15,
    difficulty: 'easy',
    explanation: 'Orwell published it in 1949.'
  },
  {
    prompt: '“Pride and Prejudice” was written by Charlotte Brontë.',
    options: 'tf',
    correct: false,
    timeLimitSec: 10,
    difficulty: 'easy',
    explanation: 'It was Jane Austen (1813).'
  },
  {
    prompt: 'In “Moby-Dick”, what is the name of the ship?',
    options: ['Pequod', 'Nautilus'],
    correct: 0,
    timeLimitSec: null,
    difficulty: 'easy',
    explanation: null
  },
  {
    prompt:
      'Early in the novel, the narrator explains that his father once told him to remember, whenever he feels like criticising anyone, that not everyone has had the advantages he has had. He says this has made him inclined to reserve all judgements. Which novel opens with this reflection?',
    options: ['The Great Gatsby', 'The Catcher in the Rye', 'Of Mice and Men', 'Tender Is the Night', 'The Sun Also Rises'],
    correct: 0,
    timeLimitSec: 60,
    difficulty: 'medium',
    explanation: 'Nick Carraway recalls his father’s advice on the first page of The Great Gatsby.'
  },
  {
    prompt: 'Which of these is NOT one of Tolkien’s works?',
    options: ['The Silmarillion', 'The Hobbit', 'The Chronicles of Narnia', 'Unfinished Tales', 'The Children of Húrin', 'Smith of Wootton Major'],
    correct: 2,
    timeLimitSec: 45,
    difficulty: 'medium',
    explanation: 'Narnia is C. S. Lewis, Tolkien’s friend and fellow Inkling.'
  },
  {
    prompt: 'Gabriel García Márquez’s “One Hundred Years of Solitude” follows the Buendía family in the town of Macondo.',
    options: 'tf',
    correct: true,
    timeLimitSec: 20,
    difficulty: 'medium',
    explanation: null
  },
  {
    prompt: 'Pick the best description of Raskolnikov’s state of mind after the crime in “Crime and Punishment”.',
    options: [
      'Calm and relieved, convinced his theory of the extraordinary man has been proven right',
      'Feverish, paranoid and tormented by guilt he refuses to admit, drifting between pride and collapse',
      'Indifferent — he immediately leaves St Petersburg and starts a new life abroad',
      'Joyful, because the money lets him finally pay for his sister’s wedding'
    ],
    correct: 1,
    timeLimitSec: 50,
    difficulty: 'hard',
    explanation: 'Most of the novel tracks his psychological unravelling, not the crime itself.'
  },
  {
    prompt: 'Year “Don Quixote” Part One was published?',
    options: ['1605', '1615', '1588'],
    correct: 0,
    timeLimitSec: 15,
    difficulty: 'hard',
    explanation: 'Part One appeared in 1605; Part Two followed in 1615.'
  },
  {
    prompt: 'Franz Kafka finished “The Trial” and published it himself in 1915.',
    options: 'tf',
    correct: false,
    timeLimitSec: 5,
    difficulty: 'hard',
    explanation: 'It was unfinished and published posthumously in 1925 by Max Brod.'
  },
  {
    prompt: 'Which narrator tells the story in “Wuthering Heights” for most of the book?',
    options: ['Mr Lockwood', 'Nelly Dean', 'Heathcliff', 'Catherine Earnshaw'],
    correct: 1,
    timeLimitSec: 30,
    difficulty: 'medium',
    explanation: 'Lockwood frames it, but housekeeper Nelly Dean narrates most of the story to him.'
  }
];

function toQuestion(seed: Seed, index: number) {
  const id = `demo-q${index + 1}`;
  if (seed.options === 'tf') {
    return {
      id,
      type: 'true_false' as const,
      prompt: seed.prompt,
      options: TRUE_FALSE_OPTION_IDS.map((optionId) => ({ id: optionId, text: optionId === 'true' ? 'True' : 'False' })),
      correctOptionId: seed.correct ? 'true' : 'false',
      timeLimitSec: seed.timeLimitSec,
      difficulty: seed.difficulty,
      explanation: seed.explanation
    };
  }
  const optionIds = seed.options.map((_, i) => `${id}-o${i + 1}`);
  return {
    id,
    type: 'mcq' as const,
    prompt: seed.prompt,
    options: seed.options.map((text, i) => ({ id: optionIds[i]!, text })),
    correctOptionId: optionIds[seed.correct as number]!,
    timeLimitSec: seed.timeLimitSec,
    difficulty: seed.difficulty,
    explanation: seed.explanation
  };
}

async function main(): Promise<void> {
  const openArg = process.argv.find((arg) => arg === '--open' || arg.startsWith('--open='));
  const openInMin = openArg?.includes('=') ? Number(openArg.split('=')[1]) : 0;
  if (!Number.isFinite(openInMin) || openInMin < 0) throw new Error('--open=<minutes> must be a non-negative number.');
  const openNow = Boolean(openArg);
  await connectToDatabase();

  const quest = await QuestModel.findOne({ isCurrent: true });
  if (!quest) throw new Error('No current quest. Run `seed` first.');
  if (await questHasAttempts(quest._id)) {
    logger.warn({ edition: quest.edition }, 'Participants have started this quest; its quiz setup is locked. Nothing seeded.');
    return disconnectFromDatabase();
  }

  const admin = (await UserModel.findOne({ role: 'admin' })) ?? (await UserModel.findOne());
  if (!admin) throw new Error('No user to own the quiz. Sign in once first.');

  const content = {
    settings: { shuffleQuestions: false, shuffleOptions: true, defaultTimeLimitSec: DEFAULT_TIME_LIMIT_SEC },
    questions: QUESTIONS.map(toQuestion)
  };
  const issues = findQuizIssues(content);
  if (issues) throw new Error(`Demo quiz content is invalid: ${JSON.stringify(issues)}`);

  const quiz = await QuizModel.findOneAndUpdate(
    { title: TITLE },
    {
      $set: { description: 'Hand-written demo: mixed types, lengths and timers.', ...content },
      $inc: { revision: 1 },
      $setOnInsert: { createdBy: admin._id }
    },
    { upsert: true, returnDocument: 'after' }
  );

  // Replaces any existing setup (e.g. the A/B samples) with this one quiz.
  const built = await buildQuizConfig(quest, { distribution: 'single', quizIds: [quiz.id] });
  const update: Record<string, unknown> = { ...built };

  if (openNow) {
    const now = Date.now();
    // Registration closes at readingDeadline, so a delayed open leaves time to sign up first.
    const quizOpensAt = new Date(openInMin > 0 ? now + openInMin * 60_000 : now - 60_000);
    const quizClosesAt = new Date(quizOpensAt.getTime() + OPEN_FOR_MS);
    // Keep the date order valid: opensAt < readingDeadline <= quizOpensAt < quizClosesAt <= resultsAt.
    Object.assign(update, {
      opensAt: quest.opensAt < quizOpensAt ? quest.opensAt : new Date(now - 2 * 86_400_000),
      readingDeadline: quizOpensAt,
      quizOpensAt,
      quizClosesAt,
      resultsAt: new Date(quizClosesAt.getTime() + RESULTS_AFTER_CLOSE_MS)
    });
  }

  await QuestModel.updateOne({ _id: quest._id }, { $set: update });
  logger.info(
    { edition: quest.edition, quiz: quiz.id, questions: QUESTIONS.length, windowOpened: openNow, opensInMin: openInMin },
    'Seeded demo quiz (single)'
  );
  await disconnectFromDatabase();
}

main().catch(async (error: unknown) => {
  logger.error({ err: error }, 'Demo quiz seed failed');
  await disconnectFromDatabase();
  process.exit(1);
});
