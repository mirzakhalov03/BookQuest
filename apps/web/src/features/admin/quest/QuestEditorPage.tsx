import { useMemo, useState, type FormEvent } from 'react';
import { findQuestDateIssues } from '@bookquest/shared';
import type { Quest } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { AdminScreen } from '@/layouts/AdminLayout';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState, FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { ApiRequestError, isNotFound } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui.store';
import { useUpdateQuest } from '../api/useUpdateQuest';
import { ForbiddenState, isForbidden } from '../components/ForbiddenState';
import { BookFieldsSection } from './components/BookFieldsSection';
import { ResourceListEditor } from './components/ResourceListEditor';
import { PrizeFieldsSection } from './components/PrizeFieldsSection';
import { QuestDateFieldsSection } from './components/QuestDateFieldsSection';
import { QuizMetaFieldsSection } from './components/QuizMetaFieldsSection';
import { buildQuestPatch, formDates, isValidResourceUrl, toFormState, type QuestFormState } from './questForm';

/**
 * `/admin/quest` — book, resources, prizes, the five dates, quiz metadata.
 * `edition`, `year` and `participantCount` are absent on purpose: the
 * server's body schema is strict about them (spec: "identity" and "owned by
 * the registration path"), so there is nothing here that could send them.
 */
export function QuestEditorPage() {
  const quest = useCurrentQuest();

  if (quest.isPending) return <LoadingState label="Opening the ledger…" />;

  if (quest.error) {
    if (isForbidden(quest.error)) return <ForbiddenState error={quest.error} />;

    if (isNotFound(quest.error)) {
      return (
        <EmptyState
          title={quest.error.message}
          body="There's nothing to edit between editions."
          className="flex-1"
        />
      );
    }

    return <ErrorState error={quest.error} onRetry={() => quest.refetch()} className="flex-1" />;
  }

  // A fresh instance per loaded quest (keyed on its id) rather than syncing
  // an effect to prop changes — the id changes only when a different edition
  // becomes current, which remounts the form with a clean slate instead of
  // trying to reconcile in-progress edits against a swapped-out quest.
  return <QuestEditorForm key={quest.data.id} quest={quest.data} />;
}

function QuestEditorForm({ quest }: { quest: Quest }) {
  const [form, setForm] = useState<QuestFormState>(() => toFormState(quest));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isCoverUploading, setIsCoverUploading] = useState(false);
  const showToast = useUiStore((state) => state.showToast);
  const update = useUpdateQuest(quest.id);

  // Live feedback that mirrors, never replaces, the server's own check
  // (plan Phase 4) — `findQuestDateIssues` is the exact function
  // `PATCH /admin/quests/:id` calls after merging, imported from
  // `@bookquest/shared` rather than reimplemented. Computed straight from
  // render, not an effect, so there's nothing here whose dependency array a
  // fresh object could ever destabilise.
  const dateIssues = useMemo(() => findQuestDateIssues(formDates(form)), [form.dates]);
  const patch = useMemo(() => buildQuestPatch(quest, form), [quest, form]);
  const resourcesAreValid = form.book.resources.every(
    (resource) => resource.url.trim() === '' || isValidResourceUrl(resource.url)
  );

  const canSubmit =
    patch !== null && !dateIssues && resourcesAreValid && !update.isPending && !isCoverUploading;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (!patch) return;

    setFormError(null);

    try {
      const updated = await update.mutateAsync(patch);
      // The server's answer becomes the new baseline — further edits diff
      // against what was actually saved, not against the stale pre-edit copy.
      setForm(toFormState(updated));
      setFieldErrors({});
      showToast('Quest updated.');
    } catch (error) {
      if (!(error instanceof ApiRequestError)) {
        setFormError(FALLBACK_MESSAGE);
        return;
      }
      // Same convention as the registration form (spec §6): `error.fields`
      // keys the same as the request body, dropped straight onto the
      // matching input by dotted path.
      setFieldErrors(error.fields);
      if (Object.keys(error.fields).length === 0) setFormError(error.message);
    }
  }

  return (
    <AdminScreen className="max-w-3xl">
      <header className="flex flex-col gap-1">
        <p className="type-label">Quest · {quest.year}</p>
        <h1 className="type-display text-3xl text-paper">{quest.book.title}</h1>
      </header>

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-8">
        <BookFieldsSection
          value={form.book}
          errors={fieldErrors}
          onPatch={(patch) => setForm((prev) => ({ ...prev, book: { ...prev.book, ...patch } }))}
          onCoverUploadingChange={setIsCoverUploading}
        />

        <ResourceListEditor
          resources={form.book.resources}
          errors={fieldErrors}
          onChange={(resources) =>
            setForm((prev) => ({ ...prev, book: { ...prev.book, resources } }))
          }
        />

        <PrizeFieldsSection
          value={form.prizes}
          errors={fieldErrors}
          onChange={(prizes) => setForm((prev) => ({ ...prev, prizes }))}
        />

        <QuestDateFieldsSection
          value={form.dates}
          issues={dateIssues}
          errors={fieldErrors}
          onChange={(dates) => setForm((prev) => ({ ...prev, dates }))}
        />

        <QuizMetaFieldsSection
          questionCount={form.quizQuestionCount}
          durationMinutes={form.quizDurationMinutes}
          errors={fieldErrors}
          onChangeQuestionCount={(value) => setForm((prev) => ({ ...prev, quizQuestionCount: value }))}
          onChangeDurationMinutes={(value) =>
            setForm((prev) => ({ ...prev, quizDurationMinutes: value }))
          }
        />

        {formError && (
          <p role="alert" className="m-0 text-sm text-error">
            {formError}
          </p>
        )}

        <div className="flex items-center gap-4 border-t border-[color:var(--rule)] pt-6">
          <Button type="submit" disabled={!canSubmit}>
            {update.isPending ? 'Saving…' : 'Save changes'}
          </Button>
          {patch === null && <p className="text-sm text-taupe">Nothing to save yet.</p>}
        </div>
      </form>
    </AdminScreen>
  );
}
