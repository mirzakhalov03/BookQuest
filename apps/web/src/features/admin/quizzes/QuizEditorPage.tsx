import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Eye, Lock } from 'lucide-react';
import { saveQuizSchema, type QuizAdmin } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
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
import { CorrectionSheet } from './components/CorrectionSheet';
import { CorrectionsLog } from './components/CorrectionsLog';
import { QuestionList } from './components/QuestionList';
import { QuizDetailsSection } from './components/QuizDetailsSection';
import { QuizSettingsSection } from './components/QuizSettingsSection';
import { readDraft, toQuizFormState, type QuizDraftState, type QuizFormState } from './quizForm';
import { applyQuizServerErrors } from './serverErrors';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

const QUIZ_FORM_ID = 'quiz-form';

/** `/admin/quizzes/:id` — edit one quiz. */
export function QuizEditorPage() {
  const { id = '' } = useParams();
  const query = useQuiz(id);
  const t = useT().adminQuiz.editor;

  return (
    <AdminQuery query={query} loadingLabel={t.loading}>
      {(quiz) => (
        <QuizEditorForm
          key={quiz.id}
          quiz={quiz}
          reload={async () => {
            const result = await query.refetch();
            // A failed refetch still carries the old cached quiz; only a fresh success may replace the form.
            return result.isSuccess && !result.isRefetchError ? result.data : undefined;
          }}
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
  const { handleSubmit, reset, setError, getValues, formState } = form;
  const navigate = useNavigate();
  const returnedDraft = readDraft(useLocation().state);
  const [formError, setFormError] = useState<string | null>(null);
  const [isStale, setIsStale] = useState(false);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const showToast = useUiStore((state) => state.showToast);
  const { common, admin, adminQuiz, adminQuest } = useT();
  const t = adminQuiz.editor;
  const save = useSaveQuiz(quiz.id);
  const locked = quiz.locked;
  const isDirty = formState.isDirty;
  const guard = useUnsavedChangesGuard(isDirty);

  // Coming back from the preview: restore the edits it carried, still dirty against the saved quiz.
  useEffect(() => {
    if (returnedDraft?.revision === quiz.revision) reset(returnedDraft, { keepDefaultValues: true });
    // Once per mount: later saves reset the form themselves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A correction bumps the revision; a locked form holds no edits, so it follows the server.
  useEffect(() => {
    if (locked) reset(toQuizFormState(quiz));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quiz.revision]);

  function openPreview() {
    // The preview carries the edits in router state; the guard would otherwise ask to discard them.
    guard.bypass();
    const state: QuizDraftState = { draft: getValues() };
    void navigate(`/admin/quizzes/${quiz.id}/preview`, { state });
  }

  const submit = handleSubmit(async (valid) => {
    setFormError(null);
    try {
      const saved = await save.mutateAsync(valid);
      // The server's answer is the new baseline, including its bumped revision.
      reset(toQuizFormState(saved));
      setIsStale(false);
      showToast(t.saved);
    } catch (error) {
      if (error instanceof ApiRequestError && error.reason === 'stale') setIsStale(true);
      else if (error instanceof ApiRequestError && error.reason === 'quiz_locked') setFormError(errorMessage(error));
      else setFormError(error instanceof ApiRequestError ? applyQuizServerErrors(error, setError) : errorMessage(error));
    }
  });

  async function reloadLatest() {
    const latest = await reload();
    if (!latest) return showToast(t.reloadFailed);
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
        <AdminPageHeader
          eyebrow={t.eyebrow}
          title={quiz.title}
          actions={
            <Button type="button" variant="quiet" onClick={openPreview} className="min-h-11 gap-2 px-3">
              <Eye className="h-4 w-4" aria-hidden /> {t.preview}
            </Button>
          }
        />

        {locked && (
          <p role="status" className="m-0 flex items-start gap-2 rounded-box border border-amber/40 p-3 text-sm text-amber">
            <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden /> {t.lockedBanner}
          </p>
        )}
        {quiz.usedIn.length > 0 && (
          <p className="m-0 text-sm text-taupe">
            {t.usedIn(quiz.usedIn.map((edition) => adminQuiz.edition(edition)).join(', '))}
          </p>
        )}

        <form id={QUIZ_FORM_ID} onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-6">
          <fieldset disabled={locked} className="m-0 flex min-w-0 flex-col gap-6 border-0 p-0">
            <div className="flex flex-col gap-4">
              <QuizDetailsSection />
              <QuizSettingsSection />
            </div>
          </fieldset>
          <QuestionList
            locked={locked}
            voidedIds={quiz.voidedQuestionIds}
            onCorrect={setCorrectingId}
            raised={isDirty}
            dock={
              (isStale || formError) && (
                <>
                  {isStale && (
                    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-box border border-amber/40 bg-[color:var(--color-ink)] p-3 text-sm text-amber">
                      <span className="flex-1">{t.stale}</span>
                      <Button type="button" variant="quiet" onClick={() => void reloadLatest()} className="min-h-11 px-3 text-amber">
                        {t.reload}
                      </Button>
                    </div>
                  )}
                  {formError && (
                    <p role="alert" className="m-0 rounded-box border border-error-line bg-[color:var(--color-ink)] p-3 text-sm text-error">
                      {formError}
                    </p>
                  )}
                </>
              )
            }
          />
        </form>

        <CorrectionsLog quiz={quiz} />

        {isDirty && <div aria-hidden className="h-20" />}
      </AdminScreen>

      <SaveBar
        visible={isDirty}
        summary={errorCount > 0 ? adminQuest.fixFields(errorCount) : admin.unsavedRegion}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel={common.save}
        busyLabel={common.saving}
        isBusy={save.isPending}
        disabled={!canSave}
        formId={QUIZ_FORM_ID}
        onDiscard={() => {
          setFormError(null);
          reset();
        }}
      />
      <UnsavedChangesSheet blocker={guard.blocker} />
      {locked && <CorrectionSheet quiz={quiz} questionId={correctingId} onClose={() => setCorrectingId(null)} />}
    </FormProvider>
  );
}
