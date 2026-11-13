import { useState } from 'react';
import { Link } from 'react-router';
import { useController, useFormContext, useWatch } from 'react-hook-form';
import { ChevronDown, Lock, Minus, Plus } from 'lucide-react';
import { QUIZ_GROUP_COUNTS, type AdminQuest, type QuizSummaryAdmin } from '@bookquest/shared';
import { Segmented } from '@/components/ui/Segmented';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { useQuizzes } from '../../api/useQuizzes';
import { useQuizGroupSizes } from '../../api/useQuizGroupSizes';
import { parseLocal } from '../../dates';
import { formatQuizDuration } from '../../quizzes/format';
import type { EditorSectionId } from '../changes';
import {
  SPLIT_DISTRIBUTIONS,
  localGroupLabels,
  resizeQuizIds,
  type QuizConfigForm,
  type SplitDistribution
} from '../quizConfig';
import { checkReadiness, pickableQuizzes } from '../quizReadiness';
import type { QuestFormState } from '../questForm';
import { QuizReadinessList } from './QuizReadinessList';
import { useT } from '@/i18n';

interface QuizConfigSectionProps {
  quest: AdminQuest;
  /** Set once a save came back `quiz_locked`; the section is read-only for the rest of the session. */
  lockMessage: string | null;
  onGoTo: (section: EditorSectionId) => void;
}

const isSplit = (config: QuizConfigForm | null): boolean =>
  config !== null && config.distribution !== 'single';

/**
 * One quiz for everyone by default. Splitting by odd/even or random groups is
 * one tap away, and opens by itself when the saved setup already uses it.
 */
export function QuizConfigSection({ quest, lockMessage, onGoTo }: QuizConfigSectionProps) {
  const { control } = useFormContext<QuestFormState>();
  const {
    field: { value: config, onChange },
    fieldState: { error }
  } = useController({ control, name: 'quizConfig' });
  const dates = useWatch({ control, name: 'dates' });
  const quizzes = useQuizzes();
  const sizes = useQuizGroupSizes(config?.distribution ?? null, config?.quizIds.length ?? 0);
  const [splitOpen, setSplitOpen] = useState(() => isSplit(config));
  const locked = lockMessage !== null;
  const { common, adminQuest } = useT();
  const t = adminQuest.quiz;
  // "Odd numbers" reads better as "Odd" next to a count.
  const shortLabel = (label: string) =>
    label === t.odd ? t.oddShort : label === t.even ? t.evenShort : label;

  const set = (next: QuizConfigForm | null) => onChange(next);
  const setSingle = (id: string) => set(id ? { distribution: 'single', quizIds: [id] } : null);
  const setDistribution = (distribution: SplitDistribution) => {
    const { min, max } = QUIZ_GROUP_COUNTS[distribution];
    const count = Math.min(max, Math.max(min, config?.quizIds.length ?? min));
    set({ distribution, quizIds: resizeQuizIds(config?.quizIds ?? [], count) });
  };
  const setGroupCount = (count: number) =>
    config && set({ ...config, quizIds: resizeQuizIds(config.quizIds, count) });
  const setQuiz = (index: number, id: string) =>
    config &&
    set({ ...config, quizIds: config.quizIds.map((current, i) => (i === index ? id : current)) });

  // Closing the split never leaves a setup on screen that the admin can't see: it drops to one quiz, keeping the first pick.
  function toggleSplit() {
    if (splitOpen && config && isSplit(config)) setSingle(config.quizIds[0] ?? '');
    setSplitOpen(!splitOpen);
  }

  const labels = config ? localGroupLabels(config.distribution, config.quizIds.length) : [];
  const range = config ? QUIZ_GROUP_COUNTS[config.distribution] : null;
  const noQuizYet = quest.quizConfig === null && Date.now() >= Date.parse(quest.quizOpensAt);
  const quizOptions = (library: QuizSummaryAdmin[], current: string) => [
    { value: '', label: t.chooseQuiz },
    ...pickableQuizzes(library, quest.edition, config?.quizIds ?? [])
      .filter((quiz) => quiz.id === current || !config?.quizIds.includes(quiz.id))
      .map((quiz) => ({
        value: quiz.id,
        label: t.quizOption(
          quiz.title,
          common.questions(quiz.questionCount, String(quiz.questionCount)),
          formatQuizDuration(quiz.totalSeconds),
          quiz.isComplete
        )
      }))
  ];

  return (
    <>
      {noQuizYet && (
        <p role="alert" className="m-0 rounded-box border border-error/50 p-3 text-sm text-error">
          {t.noQuizBanner}
        </p>
      )}
      {locked && (
        <p
          role="status"
          className="m-0 flex items-start gap-2 rounded-box border border-amber/40 p-3 text-sm text-amber"
        >
          <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {lockMessage}
        </p>
      )}

      <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-4 border-0 p-0">
        {quizzes.isPending && <p className="m-0 text-sm text-taupe">{t.loadingQuizzes}</p>}
        {quizzes.isError && (
          <p role="alert" className="m-0 text-sm text-error">
            {t.libraryFailed}{' '}
            <button
              type="button"
              onClick={() => void quizzes.refetch()}
              className="text-amber underline"
            >
              {common.tryAgain}
            </button>
          </p>
        )}

        {!splitOpen && quizzes.data && (
          // The empty option detaches the quiz.
          <Select
            label={t.quiz}
            value={config?.quizIds[0] ?? ''}
            onChange={setSingle}
            options={quizOptions(quizzes.data, config?.quizIds[0] ?? '')}
          />
        )}

        <button
          type="button"
          aria-expanded={splitOpen}
          onClick={toggleSplit}
          className="inline-flex min-h-11 items-center gap-1.5 self-start text-sm text-taupe hover:text-paper-dim"
        >
          {splitOpen ? t.splitOff : t.splitToggle}
          <ChevronDown
            aria-hidden
            className={`h-4 w-4 transition-transform ${splitOpen ? 'rotate-180' : ''}`}
          />
        </button>

        {splitOpen && (
          <div className="flex flex-col gap-4 border-l-2 border-[color:var(--rule)] pl-4">
            <Segmented<SplitDistribution | 'none'>
              aria-label={t.distributionAria}
              options={SPLIT_DISTRIBUTIONS.map((value) => ({
                value,
                label: t.distribution[value]
              }))}
              value={
                config && isSplit(config) ? (config.distribution as SplitDistribution) : 'none'
              }
              onChange={(value) => value !== 'none' && setDistribution(value)}
            />

            {config && isSplit(config) && range && range.min !== range.max && (
              <div className="flex items-center gap-3">
                <span className="type-label">{t.groups}</span>
                <Button
                  type="button"
                  variant="quiet"
                  aria-label={t.fewer}
                  disabled={config.quizIds.length <= range.min}
                  onClick={() => setGroupCount(config.quizIds.length - 1)}
                  className="min-h-11 w-11 px-0"
                >
                  <Minus className="h-4 w-4" aria-hidden />
                </Button>
                <span className="w-4 text-center text-paper tabular-nums">
                  {config.quizIds.length}
                </span>
                <Button
                  type="button"
                  variant="quiet"
                  aria-label={t.more}
                  disabled={config.quizIds.length >= range.max}
                  onClick={() => setGroupCount(config.quizIds.length + 1)}
                  className="min-h-11 w-11 px-0"
                >
                  <Plus className="h-4 w-4" aria-hidden />
                </Button>
              </div>
            )}

            {config &&
              isSplit(config) &&
              quizzes.data &&
              config.quizIds.map((id, index) => (
                <Select
                  key={index}
                  label={labels[index] ?? t.group(index + 1)}
                  value={id}
                  onChange={(next) => setQuiz(index, next)}
                  options={quizOptions(quizzes.data, id)}
                />
              ))}

            {config && isSplit(config) && sizes.data !== undefined && (
              <p className="m-0 text-sm text-taupe">
                {sizes.data === null
                  ? t.splitRandom
                  : sizes.data
                      .map((count, i) => `${shortLabel(labels[i] ?? t.group(i + 1))}: ${count}`)
                      .join(' · ')}
              </p>
            )}
          </div>
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
          quizOpensAt={parseLocal(dates.quizOpensAt)}
          onGoToDates={() => onGoTo('dates')}
        />
      )}

      <p className="m-0 flex flex-wrap items-center gap-x-2 text-sm text-taupe">
        {t.locksWhen}
        <Link
          to="/admin/quizzes"
          className="group inline-flex min-h-11 items-center gap-1 text-amber"
        >
          {t.manageQuizzes}
          <ArrowIcon />
        </Link>
      </p>
    </>
  );
}
