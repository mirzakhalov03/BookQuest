import { useState } from 'react';
import { Activity, Plus } from 'lucide-react';
import type { QuizSummaryAdmin } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ApiRequestError } from '@/lib/api/client';
import { useCurrentQuest } from '@/lib/api/quest';
import { useUiStore } from '@/stores/ui.store';
import { useDeleteQuiz, useDuplicateQuiz, useQuizzes } from '../api/useQuizzes';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQuery } from '../components/AdminQuery';
import { NewQuizSheet } from './components/NewQuizSheet';
import { QuizCard } from './components/QuizCard';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

/** `/admin/quizzes` — the quiz library. */
export function QuizzesPage() {
  const quizzes = useQuizzes();
  const t = useT().adminQuiz.library;
  const [creating, setCreating] = useState(false);
  const quest = useCurrentQuest().data;
  // Live while the quiz is open, and until results go out (void is still possible then).
  const showLive =
    quest !== undefined &&
    (quest.phase === 'quiz' || (quest.phase === 'finished' && Date.now() < Date.parse(quest.resultsAt)));

  return (
    <AdminScreen className="max-w-5xl">
      <AdminPageHeader
        eyebrow={t.eyebrow}
        title={t.title}
        actions={
          <>
            {showLive && (
              <Button to="/admin/quizzes/live" variant="quiet" className="min-h-11 px-4">
                <Activity className="h-4 w-4" aria-hidden /> {t.live}
              </Button>
            )}
            <Button type="button" onClick={() => setCreating(true)} className="min-h-11 px-4">
              <Plus className="h-4 w-4" aria-hidden /> {t.newQuiz}
            </Button>
          </>
        }
      />
      <AdminQuery query={quizzes} loadingLabel={t.loading}>
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              titleAs="h2"
              title={t.emptyTitle}
              body={t.emptyBody}
              className="flex-1"
            />
          ) : (
            <QuizGrid quizzes={list} />
          )
        }
      </AdminQuery>
      <NewQuizSheet open={creating} onClose={() => setCreating(false)} />
    </AdminScreen>
  );
}

function QuizGrid({ quizzes }: { quizzes: QuizSummaryAdmin[] }) {
  const [deleting, setDeleting] = useState<QuizSummaryAdmin | null>(null);
  const duplicate = useDuplicateQuiz();
  const remove = useDeleteQuiz();
  const showToast = useUiStore((state) => state.showToast);
  const { common, adminQuiz } = useT();
  const t = adminQuiz.library;

  // A 409 carries the server's own explanation, so it is shown as written.
  const report = (error: unknown) =>
    showToast(error instanceof ApiRequestError ? errorMessage(error) : common.somethingWentWrong);

  async function confirmDelete() {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      showToast(t.deleted);
    } catch (error) {
      report(error);
    }
  }

  return (
    <>
      <ul className="m-0 grid list-none grid-cols-1 gap-3 p-0 md:grid-cols-2">
        {quizzes.map((quiz) => (
          <QuizCard
            key={quiz.id}
            quiz={quiz}
            busy={duplicate.isPending || remove.isPending}
            onDuplicate={() =>
              duplicate.mutate(quiz.id, { onSuccess: () => showToast(t.duplicated), onError: report })
            }
            onDelete={() => setDeleting(quiz)}
          />
        ))}
      </ul>
      <Sheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={t.deleteTitle}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setDeleting(null)}>
              {t.keepIt}
            </Button>
            <Button type="button" onClick={() => void confirmDelete()}>
              {t.delete}
            </Button>
          </>
        }
      >
        <p className="m-0 text-taupe">{t.deleteBody(deleting?.title ?? '')}</p>
      </Sheet>
    </>
  );
}
