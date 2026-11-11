import { useState } from 'react';
import { useParams } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Lock } from 'lucide-react';
import { saveQuizSchema, type QuizAdmin } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { ApiRequestError } from '@/lib/api/client';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useUiStore } from '@/stores/ui.store';
import { useQuiz, useSaveQuiz } from '../api/useQuizzes';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQuery } from '../components/AdminQuery';
import { SaveBar } from '../components/SaveBar';
import { UnsavedChangesSheet } from '../components/UnsavedChangesSheet';
import { QuestionList } from './components/QuestionList';
import { QuizDetailsSection } from './components/QuizDetailsSection';
import { QuizSettingsSection } from './components/QuizSettingsSection';
import { QuizSummaryBar } from './components/QuizSummaryBar';
import { toQuizFormState, type QuizFormState } from './quizForm';
import { applyQuizServerErrors } from './serverErrors';

const QUIZ_FORM_ID = 'quiz-form';
const LOCKED_BANNER =
  'Locked — participants have started this quiz. You can still correct an answer key (below each question).';
const STALE_MESSAGE = 'Someone else saved this quiz. Reload to see their version';

/** `/admin/quizzes/:id` — edit one quiz. */
export function QuizEditorPage() {
  const { id = '' } = useParams();
  const query = useQuiz(id);

  return (
    <AdminQuery query={query} loadingLabel="Opening the quiz…">
      {(quiz) => (
        <QuizEditorForm
          key={quiz.id}
          quiz={quiz}
          reload={async () => (await query.refetch()).data}
        />
      )}
    </AdminQuery>
  );
}

function QuizEditorForm({ quiz, reload }: { quiz: QuizAdmin; reload: () => Promise<QuizAdmin | undefined> }) {
  const form = useForm<QuizFormState>({
    resolver: zodResolver(saveQuizSchema),
    defaultValues: toQuizFormState(quiz),
    mode: 'onChange'
  });
  const { handleSubmit, reset, setError, formState } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const save = useSaveQuiz(quiz.id);
  const locked = quiz.locked;
  const isDirty = formState.isDirty;
  const guard = useUnsavedChangesGuard(isDirty);

  const submit = handleSubmit(async (valid) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync(valid);
      // The server's answer is the new baseline, including its bumped revision.
      reset(toQuizFormState(saved));
      setIsStale(false);
      showToast('Quiz saved.');
    } catch (error) {
      if (error instanceof ApiRequestError && error.reason === 'stale') setIsStale(true);
      else if (error instanceof ApiRequestError && error.reason === 'quiz_locked') setFormError(error.message);
      else setFormError(error instanceof ApiRequestError ? applyQuizServerErrors(error, setError) : FALLBACK_MESSAGE);
    }
  });

  async function reloadLatest() {
    const latest = await reload();
    if (!latest) return;
    reset(toQuizFormState(latest));
    setIsStale(false);
    setFormError(null);
  }

  const canSave = isDirty && !locked && !save.isPending;
  useSaveShortcut(canSave ? () => void submit() : null);

  const errorCount = Object.keys(formState.errors).length;

  return (
    <FormProvider {...form}>
      <AdminScreen className="max-w-3xl">
        <AdminPageHeader eyebrow="Quiz" title={quiz.title} />

        {locked && (
          <p role="status" className="m-0 flex items-start gap-2 rounded-box border border-amber/40 p-3 text-sm text-amber">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {LOCKED_BANNER}
          </p>
        )}
        {quiz.usedIn.length > 0 && (
          <p className="m-0 text-sm text-taupe">
            Used in {quiz.usedIn.map((edition) => `Edition ${edition}`).join(', ')}.
          </p>
        )}

        <form id={QUIZ_FORM_ID} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-6">
          <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
            <div className="flex flex-col gap-4">
              <QuizDetailsSection />
              <QuizSettingsSection />
            </div>
          </fieldset>
          <QuestionList locked={locked} />

          {isStale && (
            <div role="alert" className="flex flex-wrap items-center gap-3 rounded-box border border-amber/40 p-3 text-sm text-amber">
              <span className="flex-1">{STALE_MESSAGE}</span>
              <Button type="button" variant="quiet" onClick={() => void reloadLatest()} className="min-h-11 px-3 text-amber">
                Reload
              </Button>
            </div>
          )}
          {formError && (
            <p role="alert" className="m-0 text-sm text-error">
              {formError}
            </p>
          )}
          <QuizSummaryBar raised={isDirty} />
        </form>

        {isDirty && <div aria-hidden className="h-20" />}
      </AdminScreen>

      <SaveBar
        visible={isDirty}
        summary={errorCount > 0 ? `Fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'}` : 'Unsaved changes'}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel="Save"
        busyLabel="Saving…"
        isBusy={save.isPending}
        disabled={!canSave}
        formId={QUIZ_FORM_ID}
        onDiscard={() => {
          setFormError(null);
          reset();
        }}
      />
      <UnsavedChangesSheet blocker={guard.blocker} />
    </FormProvider>
  );
}
