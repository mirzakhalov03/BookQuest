import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateQuestPayload } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ApiRequestError } from '@/lib/api/client';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { useUiStore } from '@/stores/ui.store';
import { useLatestQuest, type LatestQuest } from '../api/useLatestQuest';
import { useCreateQuest } from '../api/useCreateQuest';
import { AdminQuery } from '../components/AdminQuery';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { SaveBar } from '../components/SaveBar';
import { UnsavedChangesSheet } from '../components/UnsavedChangesSheet';
import { QuestFormFields } from './components/QuestFormFields';
import { PreviewButton, QuestEditorLayout, QuestPreview } from './components/QuestPreview';
import { NO_CHANGES, countErrors } from './changes';
import { buildCreatePayload, nextEditionDraft } from './nextEdition';
import { questFormSchema } from './questFormSchema';
import { applyServerErrors } from './serverErrors';
import type { QuestFormState } from './questForm';

const FORM_ID = 'new-edition-form';

/** `/admin/quest/new` — a sub-page of the quest tab, so it gets Telegram's back button. */
export function NewEditionPage() {
  useTelegramBackButton('/admin/quest');
  const latest = useLatestQuest();

  return (
    <AdminQuery query={latest} loadingLabel="Finding the last edition…">
      {(source) =>
        source?.isCurrent && source.quest.phase !== 'finished' ? (
          <EmptyState
            title={`Edition ${source.quest.edition} is still running`}
            body="Start the next edition once its quiz has closed."
            action={
              <Button to="/admin/quest" variant="quiet">
                Back to the quest
              </Button>
            }
            className="flex-1"
          />
        ) : (
          <NewEditionForm key={source?.quest.id ?? 'first'} source={source} />
        )
      }
    </AdminQuery>
  );
}

function NewEditionForm({ source }: { source: LatestQuest }) {
  const [draft] = useState(() => nextEditionDraft(source?.quest ?? null, new Date()));
  const form = useForm<QuestFormState>({
    resolver: zodResolver(questFormSchema),
    defaultValues: draft.values,
    mode: 'onChange'
  });
  const { handleSubmit, setError, watch, formState } = form;
  const [payload, setPayload] = useState<CreateQuestPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const create = useCreateQuest();
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const guard = useUnsavedChangesGuard(formState.isDirty);

  const values = watch();
  const preview = <QuestPreview edition={draft.edition} values={values} />;
  const errorCount = countErrors(formState.errors);

  const submit = handleSubmit((valid) => {
    setFormError(null);
    setPayload(buildCreatePayload(draft.edition, valid));
  });

  async function confirm() {
    if (!payload) return;
    try {
      await create.mutateAsync(payload);
      guard.bypass();
      showToast(`Edition ${draft.edition} is live.`);
      navigate('/admin/quest');
    } catch (error) {
      setPayload(null);
      setFormError(error instanceof ApiRequestError ? applyServerErrors(error, setError) : FALLBACK_MESSAGE);
    }
  }

  return (
    <FormProvider {...form}>
      <AdminScreen className="max-w-5xl">
        <AdminPageHeader eyebrow="New edition" title={`Edition ${draft.edition}`} actions={<PreviewButton preview={preview} />} />
        <p className="m-0 text-sm text-taupe">
          {source
            ? `Prizes, quiz settings and the schedule carry over from edition ${source.quest.edition}, a year later. The book starts blank.`
            : 'The first edition. The schedule below is a starting point — adjust it to taste.'}
        </p>

        <QuestEditorLayout preview={preview}>
          <form id={FORM_ID} onSubmit={submit} noValidate className="flex flex-col gap-6">
            <QuestFormFields changes={NO_CHANGES} savedDates={null} onCoverUploadingChange={setIsCoverUploading} />
            {formError && (
              <p role="alert" className="m-0 text-sm text-error">
                {formError}
              </p>
            )}
          </form>
        </QuestEditorLayout>

        <div aria-hidden className="h-20" />
      </AdminScreen>

      <SaveBar
        visible
        summary={errorCount > 0 ? `Fix ${errorCount} ${errorCount === 1 ? 'field' : 'fields'}` : `Edition ${draft.edition}, ready when the book is in`}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel="Create edition"
        busyLabel="Creating…"
        isBusy={create.isPending}
        disabled={create.isPending || isCoverUploading}
        formId={FORM_ID}
        onDiscard={() => navigate('/admin/quest')}
        discardLabel="Cancel"
      />

      <Sheet
        open={payload !== null}
        onClose={() => setPayload(null)}
        title={`Make edition ${draft.edition} current?`}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setPayload(null)}>
              Not yet
            </Button>
            <Button type="button" onClick={() => void confirm()} disabled={create.isPending}>
              {create.isPending ? 'Creating…' : 'Create and go live'}
            </Button>
          </>
        }
      >
        <p className="m-0 text-taupe">
          {source?.isCurrent ? `Edition ${source.quest.edition} and its results move to the archive. ` : ''}
          Participants see edition {draft.edition} on the Home screen straight away.
        </p>
      </Sheet>

      <UnsavedChangesSheet blocker={guard.blocker} />
    </FormProvider>
  );
}
