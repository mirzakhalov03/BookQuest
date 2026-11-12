import { useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { AdminQuest, UpdateQuestPayload } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { ApiRequestError } from '@/lib/api/client';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useUiStore } from '@/stores/ui.store';
import { useAdminCurrentQuest } from '../api/useAdminCurrentQuest';
import { useQuizzes } from '../api/useQuizzes';
import { useUpdateQuest } from '../api/useUpdateQuest';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { SaveBar } from '../components/SaveBar';
import { UnsavedChangesSheet } from '../components/UnsavedChangesSheet';
import { ReviewChangesSheet } from './components/ReviewChangesSheet';
import { QuestFormFields } from './components/QuestFormFields';
import { buildQuestPatch, toFormState, type QuestFormState } from './questForm';
import { questFormSchema } from './questFormSchema';
import { applyServerErrors } from './serverErrors';
import { countErrors } from './changes';
import { useQuestChanges } from './useQuestChanges';
import { describeRiskyChanges, needsReview } from './review';
import { canStartNextEdition } from '../phase';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

export const QUEST_FORM_ID = 'quest-form';

/** `/admin/quest` — the current quest's book, resources, prizes, dates and quiz settings. */
export function QuestEditorPage() {
  const t = useT();
  const quest = useAdminCurrentQuest();

  return (
    <AdminQuery
      query={quest}
      loadingLabel={t.adminQuest.loading}
      notFound={(error) => (
        <EmptyState
          title={errorMessage(error)}
          body={t.adminQuest.nothingToEdit}
          action={<Button to="/admin/quest/new">{t.admin.dashboard.startNext}</Button>}
          className="flex-1"
        />
      )}
    >
      {/* Keyed on id: a different current edition remounts with a clean form. */}
      {(data) => <QuestEditorForm key={data.id} quest={data} />}
    </AdminQuery>
  );
}

function QuestEditorForm({ quest }: { quest: AdminQuest }) {
  const form = useForm<QuestFormState>({
    resolver: zodResolver(questFormSchema),
    defaultValues: toFormState(quest),
    mode: 'onChange'
  });
  const { handleSubmit, reset, setError, formState } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingPatch, setPendingPatch] = useState<UpdateQuestPayload | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const [quizLockMessage, setQuizLockMessage] = useState<string | null>(null);
  const quizzes = useQuizzes();
  const [now] = useState(() => new Date());
  const showToast = useUiStore((state) => state.showToast);
  const t = useT();
  const update = useUpdateQuest(quest.id);

  const changes = useQuestChanges(quest, form);
  const savedDates = useMemo(() => toFormState(quest).dates, [quest]);
  const isDirty = changes.count > 0;
  const errorCount = countErrors(formState.errors);
  const guard = useUnsavedChangesGuard(isDirty);

  const quizTab = useMemo(() => ({ quest, lockMessage: quizLockMessage }), [quest, quizLockMessage]);
  const quizTitle = (id: string) => quizzes.data?.find((quiz) => quiz.id === id)?.title ?? t.adminQuest.aQuiz;

  async function save(patch: UpdateQuestPayload) {
    setFormError(null);
    try {
      const updated = await update.mutateAsync(patch);
      // The server's answer is the new baseline; later edits diff against what was saved.
      reset(toFormState(updated));
      showToast(t.adminQuest.updated);
    } catch (error) {
      setFormError(
        error instanceof ApiRequestError ? applyServerErrors(error, setError) : errorMessage(error)
      );
      if (error instanceof ApiRequestError && error.reason === 'quiz_locked') {
        setQuizLockMessage(errorMessage(error));
        // Revert the fields the server froze (their error messages stay) so the other edits can save.
        const saved = toFormState(quest);
        if ('quizConfig' in error.fields) form.setValue('quizConfig', saved.quizConfig);
        for (const key of ['quizOpensAt', 'quizClosesAt'] as const) {
          if (key in error.fields) form.setValue(`dates.${key}`, saved.dates[key]);
        }
      }
    }
  }

  const submit = handleSubmit((valid) => {
    const patch = buildQuestPatch(quest, valid);
    if (!patch) return;
    if (needsReview(quest, patch)) setPendingPatch(patch);
    else void save(patch);
  });
  // One rule for ⌘S and the Save button, so they can't drift.
  const canSave = isDirty && !update.isPending && !isCoverUploading;
  useSaveShortcut(canSave ? () => void submit() : null);

  return (
    <FormProvider {...form}>
      <AdminScreen className="max-w-5xl">
        <AdminPageHeader
          eyebrow={`BookQuest ${quest.year}`}
          actions={
            canStartNextEdition(quest, now) && (
              <Button to="/admin/quest/new" variant="quiet" className="min-h-11 px-3">
                {t.adminQuest.nextEdition}
              </Button>
            )
          }
        />

        <h1 className="sr-only">{quest.book.title}</h1>

        <form id={QUEST_FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-6">
          <QuestFormFields
            changes={changes}
            savedDates={savedDates}
            onCoverUploadingChange={setIsCoverUploading}
            quiz={quizTab}
          />
          {formError && (
            <p role="alert" className="m-0 text-sm text-error">
              {formError}
            </p>
          )}
        </form>

        {/* Room for the save bar, so the last section never hides under it. */}
        {isDirty && <div aria-hidden className="h-20" />}
      </AdminScreen>

      <SaveBar
        visible={isDirty}
        summary={
          errorCount > 0
            ? t.adminQuest.fixFields(errorCount)
            : t.adminQuest.changes(changes.count)
        }
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel={t.common.save}
        busyLabel={t.common.saving}
        isBusy={update.isPending}
        disabled={!canSave}
        formId={QUEST_FORM_ID}
        onDiscard={() => {
          setFormError(null);
          reset();
        }}
      />
      <ReviewChangesSheet
        open={pendingPatch !== null}
        lines={pendingPatch ? describeRiskyChanges(quest, pendingPatch, quizTitle) : []}
        participantCount={quest.participantCount}
        isUpcoming={quest.phase === 'upcoming'}
        onCancel={() => setPendingPatch(null)}
        onConfirm={() => {
          const patch = pendingPatch;
          setPendingPatch(null);
          if (patch) void save(patch);
        }}
      />
      <UnsavedChangesSheet blocker={guard.blocker} />
    </FormProvider>
  );
}
