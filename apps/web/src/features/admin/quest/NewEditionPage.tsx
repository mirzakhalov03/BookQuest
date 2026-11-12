import { useState } from 'react';
import { useNavigate } from 'react-router';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import type { CreateQuestPayload, Quest } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ApiRequestError } from '@/lib/api/client';
import { formatLongDate } from '@/lib/format';
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
import { LiveQuestPreview, PreviewButton, QuestEditorLayout } from './components/QuestPreview';
import { NO_CHANGES, countErrors } from './changes';
import { buildCreatePayload, nextEditionDraft } from './nextEdition';
import { questFormSchema } from './questFormSchema';
import { applyServerErrors } from './serverErrors';
import { canStartNextEdition } from '../phase';
import type { QuestFormState } from './questForm';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

const FORM_ID = 'new-edition-form';

/** `/admin/quest/new` — a sub-page of the quest tab, so it gets Telegram's back button. */
export function NewEditionPage() {
  useTelegramBackButton('/admin/quest');
  const latest = useLatestQuest();
  const t = useT().adminQuest.newEdition;
  const [now] = useState(() => new Date());

  return (
    <AdminQuery query={latest} loadingLabel={t.loading}>
      {(source) =>
        source?.isCurrent && !canStartNextEdition(source.quest, now) ? (
          <StillRunning quest={source.quest} />
        ) : (
          <NewEditionForm key={source?.quest.id ?? 'first'} source={source} />
        )
      }
    </AdminQuery>
  );
}

function StillRunning({ quest }: { quest: Quest }) {
  const awaitingResults = quest.phase === 'finished';
  const t = useT().adminQuest.newEdition;
  return (
    <EmptyState
      title={awaitingResults ? t.resultsNotOut(quest.edition) : t.stillRunning(quest.edition)}
      body={
        awaitingResults
          ? t.startAfter(formatLongDate(quest.resultsAt))
          : t.startOnceResults
      }
      action={
        <Button to="/admin/quest" variant="quiet">
          {t.backToQuest}
        </Button>
      }
      className="flex-1"
    />
  );
}

function NewEditionForm({ source }: { source: LatestQuest }) {
  const [draft] = useState(() => nextEditionDraft(source?.quest ?? null, new Date()));
  const form = useForm<QuestFormState>({
    resolver: zodResolver(questFormSchema),
    defaultValues: draft.values,
    mode: 'onChange'
  });
  const { handleSubmit, setError, formState } = form;
  const [payload, setPayload] = useState<CreateQuestPayload | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const create = useCreateQuest();
  const navigate = useNavigate();
  const showToast = useUiStore((state) => state.showToast);
  const { common, adminQuest } = useT();
  const t = adminQuest.newEdition;
  const guard = useUnsavedChangesGuard(formState.isDirty);

  // The preview subscribes itself, so typing doesn't re-render this whole page.
  const preview = <LiveQuestPreview />;
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
      showToast(t.live(draft.edition));
      navigate('/admin/quest');
    } catch (error) {
      setPayload(null);
      setFormError(error instanceof ApiRequestError ? applyServerErrors(error, setError) : errorMessage(error));
    }
  }

  return (
    <FormProvider {...form}>
      <AdminScreen className="max-w-5xl">
        <AdminPageHeader eyebrow={t.eyebrow} title={t.title(draft.edition)} actions={<PreviewButton preview={preview} />} />
        <p className="m-0 text-sm text-taupe">
          {source
            ? t.carryOver(source.quest.edition)
            : t.first}
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
        summary={errorCount > 0 ? adminQuest.fixFields(errorCount) : t.ready(draft.edition)}
        tone={errorCount > 0 ? 'bad' : 'neutral'}
        submitLabel={t.create}
        busyLabel={t.creating}
        isBusy={create.isPending}
        disabled={create.isPending || isCoverUploading}
        formId={FORM_ID}
        onDiscard={() => navigate('/admin/quest')}
        discardLabel={common.cancel}
      />

      <Sheet
        open={payload !== null}
        onClose={() => setPayload(null)}
        title={t.confirmTitle(draft.edition)}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setPayload(null)}>
              {t.notYet}
            </Button>
            <Button type="button" onClick={() => void confirm()} disabled={create.isPending}>
              {create.isPending ? t.creating : t.createLive}
            </Button>
          </>
        }
      >
        <p className="m-0 text-taupe">
          {source?.isCurrent ? t.archiveNote(source.quest.edition) : ''}
          {t.seenAtOnce(draft.edition)}
        </p>
      </Sheet>

      <UnsavedChangesSheet blocker={guard.blocker} />
    </FormProvider>
  );
}
