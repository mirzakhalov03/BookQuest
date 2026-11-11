import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createQuizSchema, QUIZ_TEXT_LIMITS } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { ApiRequestError } from '@/lib/api/client';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { useCreateQuiz } from '../../api/useQuizzes';

export function NewQuizSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateQuiz();
  const navigate = useNavigate();

  function close() {
    setTitle('');
    setError(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = createQuizSchema.safeParse({ title });
    if (!parsed.success) return setError('Give the quiz a title.');
    try {
      const quiz = await create.mutateAsync(parsed.data);
      close();
      void navigate(`/admin/quizzes/${quiz.id}`);
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : FALLBACK_MESSAGE);
    }
  }

  return (
    <Sheet open={open} onClose={close} title="New quiz">
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3">
        <Field
          label="Title"
          value={title}
          maxLength={QUIZ_TEXT_LIMITS.title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          status={error ? 'bad' : undefined}
          message={error ?? undefined}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="quiet" onClick={close}>
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Creating…' : 'Create'}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
