import { Link } from 'react-router';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { Lock, Minus, Plus } from 'lucide-react';
import { QUIZ_GROUP_COUNTS, groupLabels, type AdminQuest, type QuizDistribution } from '@bookquest/shared';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { useQuizzes } from '../../api/useQuizzes';
import { useQuizGroupSizes } from '../../api/useQuizGroupSizes';
import { parseLocal } from '../../dates';
import { formatQuizDuration } from '../../quizzes/format';
import type { EditorSectionId } from '../changes';
import { DISTRIBUTION_OPTIONS, resizeQuizIds, type QuizConfigForm } from '../quizConfig';
import { checkReadiness, pickableQuizzes } from '../quizReadiness';
import type { QuestFormState } from '../questForm';
import { QuizReadinessList } from './QuizReadinessList';

interface QuizConfigSectionProps {
  quest: AdminQuest;
  /** Set once a save came back `quiz_locked`; the section is read-only for the rest of the session. */
  lockMessage: string | null;
  onGoTo: (section: EditorSectionId) => void;
}

const NO_QUIZ_BANNER =
  'The quiz is open but no quiz is attached — participants see ‘Questions are being prepared’.';

/** "Odd numbers" reads better as "Odd" next to a count. */
const shortLabel = (label: string) => label.replace(/ numbers$/, '');

export function QuizConfigSection({ quest, lockMessage, onGoTo }: QuizConfigSectionProps) {
  const { control } = useFormContext<QuestFormState>();
  const {
    field: { value: config, onChange },
    fieldState: { error }
  } = useController({ control, name: 'quizConfig' });
  const dates = useWatch({ control, name: 'dates' });
  const quizzes = useQuizzes();
  const sizes = useQuizGroupSizes(config?.distribution ?? null, config?.quizIds.length ?? 0);
  const locked = lockMessage !== null;

  const set = (next: QuizConfigForm | null) => onChange(next);
  const setDistribution = (distribution: QuizDistribution) => {
    const { min, max } = QUIZ_GROUP_COUNTS[distribution];
    const count = Math.min(max, Math.max(min, config?.quizIds.length ?? min));
    set({ distribution, quizIds: resizeQuizIds(config?.quizIds ?? [], count) });
  };
  const setGroupCount = (count: number) => config && set({ ...config, quizIds: resizeQuizIds(config.quizIds, count) });
  const setQuiz = (index: number, id: string) =>
    config && set({ ...config, quizIds: config.quizIds.map((current, i) => (i === index ? id : current)) });

  const labels = config ? groupLabels(config.distribution, config.quizIds.length) : [];
  const range = config ? QUIZ_GROUP_COUNTS[config.distribution] : null;
  const noQuizYet = quest.quizConfig === null && Date.now() >= Date.parse(quest.quizOpensAt);

  return (
    <>
      {noQuizYet && (
        <p role="alert" className="m-0 rounded-box border border-error/50 p-3 text-sm text-error">
          {NO_QUIZ_BANNER}
        </p>
      )}
      {locked && (
        <p role="status" className="m-0 flex items-start gap-2 rounded-box border border-amber/40 p-3 text-sm text-amber">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {lockMessage}
        </p>
      )}

      <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        <Segmented<QuizDistribution | 'none'>
          aria-label="How quizzes are given out"
          options={DISTRIBUTION_OPTIONS}
          value={config?.distribution ?? 'none'}
          onChange={(value) => value !== 'none' && setDistribution(value)}
        />

        {!config && <p className="m-0 text-sm text-taupe">Choose how participants are split, then pick the quizzes.</p>}

        {config && range && range.min !== range.max && (
          <div className="flex items-center gap-3">
            <span className="type-label">Groups</span>
            <Button
              type="button"
              variant="quiet"
              aria-label="Fewer groups"
              disabled={config.quizIds.length <= range.min}
              onClick={() => setGroupCount(config.quizIds.length - 1)}
              className="min-h-11 w-11 px-0"
            >
              <Minus className="h-4 w-4" aria-hidden />
            </Button>
            <span className="w-4 text-center text-paper tabular-nums">{config.quizIds.length}</span>
            <Button
              type="button"
              variant="quiet"
              aria-label="More groups"
              disabled={config.quizIds.length >= range.max}
              onClick={() => setGroupCount(config.quizIds.length + 1)}
              className="min-h-11 w-11 px-0"
            >
              <Plus className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        )}

        {config && quizzes.isPending && <p className="m-0 text-sm text-taupe">Loading quizzes…</p>}
        {config && quizzes.isError && (
          <p role="alert" className="m-0 text-sm text-error">
            Couldn’t load the quiz library.{' '}
            <button type="button" onClick={() => void quizzes.refetch()} className="text-amber underline">
              Try again
            </button>
          </p>
        )}

        {config &&
          quizzes.data &&
          config.quizIds.map((id, index) => {
            const options = pickableQuizzes(quizzes.data, quest.edition, config.quizIds).filter(
              (quiz) => quiz.id === id || !config.quizIds.includes(quiz.id)
            );
            return (
              <Select
                key={index}
                label={labels[index] ?? `Group ${index + 1}`}
                value={id}
                onChange={(next) => setQuiz(index, next)}
                options={[
                  { value: '', label: 'Choose a quiz…' },
                  ...options.map((quiz) => ({
                    value: quiz.id,
                    label: `${quiz.title} · ${quiz.questionCount} questions · ${formatQuizDuration(quiz.totalSeconds)}${quiz.isComplete ? '' : ' · incomplete'}`
                  }))
                ]}
              />
            );
          })}

        {config && sizes.data !== undefined && (
          <p className="m-0 text-sm text-taupe">
            {sizes.data === null
              ? 'Split evenly at random when saved'
              : sizes.data.map((count, i) => `${shortLabel(labels[i] ?? `Group ${i + 1}`)}: ${count}`).join(' · ')}
          </p>
        )}

        {config && (
          <Button type="button" variant="quiet" onClick={() => set(null)} className="min-h-11 self-start px-3">
            Detach quizzes
          </Button>
        )}
      </fieldset>

      {error?.message && !locked && (
        <p role="alert" className="m-0 text-sm text-error">
          {error.message}
        </p>
      )}

      {config && quizzes.data && (
        <QuizReadinessList
          checks={checkReadiness({
            config,
            groupLabels: labels,
            quizzes: quizzes.data,
            quizOpensAt: parseLocal(dates.quizOpensAt),
            quizClosesAt: parseLocal(dates.quizClosesAt),
            resultsAt: parseLocal(dates.resultsAt)
          })}
          onGoToDates={() => onGoTo('dates')}
        />
      )}

      <p className="m-0 text-sm text-taupe">Locks when the first participant starts.</p>
      <Link to="/admin/quizzes" className="inline-flex min-h-11 items-center self-start text-sm text-amber underline-offset-2 hover:underline">
        Open the quiz library
      </Link>
    </>
  );
}
