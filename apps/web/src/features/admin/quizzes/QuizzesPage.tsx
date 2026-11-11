import { useState } from 'react';
import { Plus } from 'lucide-react';
import type { QuizSummaryAdmin } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { EmptyState } from '@/components/feedback/EmptyState';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { ApiRequestError } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui.store';
import { useDeleteQuiz, useDuplicateQuiz, useQuizzes } from '../api/useQuizzes';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { AdminQuery } from '../components/AdminQuery';
import { NewQuizSheet } from './components/NewQuizSheet';
import { QuizCard } from './components/QuizCard';

/** `/admin/quizzes` — the quiz library. */
export function QuizzesPage() {
  const quizzes = useQuizzes();
  const [creating, setCreating] = useState(false);

  return (
    <AdminScreen className="max-w-5xl">
      <AdminPageHeader
        eyebrow="Library"
        title="Quizzes"
        actions={
          <Button type="button" onClick={() => setCreating(true)} className="min-h-11 px-4">
            <Plus className="h-4 w-4" aria-hidden /> New quiz
          </Button>
        }
      />
      <AdminQuery query={quizzes} loadingLabel="Counting the questions…">
        {(list) =>
          list.length === 0 ? (
            <EmptyState
              titleAs="h2"
              title="No quizzes yet"
              body="Write one, then attach it to a quest edition."
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

  // A 409 carries the server's own explanation, so it is shown as written.
  const report = (error: unknown) =>
    showToast(error instanceof ApiRequestError ? error.message : 'Something went wrong. Try again.');

  async function confirmDelete() {
    const target = deleting;
    setDeleting(null);
    if (!target) return;
    try {
      await remove.mutateAsync(target.id);
      showToast('Quiz deleted.');
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
              duplicate.mutate(quiz.id, { onSuccess: () => showToast('Quiz duplicated.'), onError: report })
            }
            onDelete={() => setDeleting(quiz)}
          />
        ))}
      </ul>
      <Sheet
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title="Delete this quiz?"
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setDeleting(null)}>
              Keep it
            </Button>
            <Button type="button" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </>
        }
      >
        <p className="m-0 text-taupe">“{deleting?.title}” and its questions will be gone for good.</p>
      </Sheet>
    </>
  );
}
