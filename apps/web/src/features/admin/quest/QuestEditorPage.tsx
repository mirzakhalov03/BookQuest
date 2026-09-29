import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { Quest, UpdateQuestPayload } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { ApiRequestError } from '@/lib/api/client';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useSaveShortcut } from '@/hooks/useSaveShortcut';
import { useUiStore } from '@/stores/ui.store';
import { useUpdateQuest } from '../api/useUpdateQuest';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { SaveBar } from '../components/SaveBar';
import { UnsavedChangesSheet } from '../components/UnsavedChangesSheet';
import { PreviewButton, QuestEditorLayout, QuestPreview } from './components/QuestPreview';
import { ReviewChangesSheet } from './components/ReviewChangesSheet';
import { QuestFormFields } from './components/QuestFormFields';
import { buildQuestPatch, toFormState, type QuestFormState } from './questForm';
import { questFormSchema } from './questFormSchema';
import { applyServerErrors } from './serverErrors';
import { countErrors, summarizeChanges } from './changes';
import { describeRiskyChanges, needsReview } from './review';

export const QUEST_FORM_ID = 'quest-form';

/** `/admin/quest` — the current quest's book, resources, prizes, dates and quiz settings. */
export function QuestEditorPage() {
  const quest = useCurrentQuest();

  return (
    <AdminQuery
      query={quest}
      loadingLabel="Opening the ledger…"
      notFound={(error) => (
        <EmptyState title={error.message} body="There's nothing to edit between editions." className="flex-1" />
      )}
    >
      {/* Keyed on id: a different current edition remounts with a clean form. */}
      {(data) => <QuestEditorForm key={data.id} quest={data} />}
    </AdminQuery>
  );
}

function QuestEditorForm({ quest }: { quest: Quest }) {
  const form = useForm<QuestFormState>({
    resolver: zodResolver(questFormSchema),
    defaultValues: toFormState(quest),
    mode: 'onChange'
  });
  const { handleSubmit, reset, setError, watch, formState } = form;
  const [formError, setFormError] = useState<string | null>(null);
  const [pendingPatch, setPendingPatch] = useState<UpdateQuestPayload | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const update = useUpdateQuest(quest.id);

  const values = watch();
  const preview = <QuestPreview edition={quest.edition} values={values} />;
  const changes = summarizeChanges(buildQuestPatch(quest, values));
  const isDirty = changes.count > 0;
  const errorCount = countErrors(formState.errors);
  const guard = useUnsavedChangesGuard(isDirty);

  async function save(patch: UpdateQuestPayload) {
    setFormError(null);
    try {
      const updated = await update.mutateAsync(patch);
      // The server's answer is the new baseline; later edits diff against what was saved.
      reset(toFormState(updated));
      showToast('Quest updated.');
    } catch (error) {
      setFormError(error instanceof ApiRequestError ? applyServerErrors(error, setError) : FALLBACK_MESSAGE);
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
        <AdminPageHeader eyebrow={`Quest · ${quest.year}`} title={quest.book.title} actions={<PreviewButton preview={preview} />} />

        <QuestEditorLayout preview={preview}>
          <form id={QUEST_FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-6">
            <QuestFormFields changes={changes} savedDates={toFormState(quest).dates} onCoverUploadingChange={setIsCoverUploading} />
            {formError && (
              <p role="alert" className="m-0 text-sm text-error">
                {formError}
              </p>
            )}
          </form>
        </QuestEditorLayout>

        {/* Room for the save bar, so the last section never hides under it. */}
        {isDirty && <div aria-hidden className="h-20" />}
      </AdminScreen>

      <SaveBar
        visible={isDirty}
        summary={errorCount > 0 ? `Fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'}` : `${changes.count} ${changes.count === 1 ? 'change' : 'changes'}`}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel="Save"
        busyLabel="Saving…"
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
        lines={pendingPatch ? describeRiskyChanges(quest, pendingPatch) : []}
        participantCount={quest.participantCount}
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
