import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router';
import { createQuizSchema, QUIZ_TEXT_LIMITS } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { useCreateQuiz } from '../../api/useQuizzes';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

export function NewQuizSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const create = useCreateQuiz();
  const navigate = useNavigate();
  const { common, adminQuiz } = useT();
  const t = adminQuiz.library;

  function close() {
    setTitle('');
    setError(null);
    onClose();
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = createQuizSchema.safeParse({ title });
    if (!parsed.success) return setError(t.newTitleRequired);
    try {
      const quiz = await create.mutateAsync(parsed.data);
      close();
      void navigate(`/admin/quizzes/${quiz.id}`);
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet open={open} onClose={close} title={t.newQuiz}>
      <form onSubmit={(e) => void submit(e)} noValidate className="flex flex-col gap-3">
        <Field
          label={t.titleField}
          value={title}
          maxLength={QUIZ_TEXT_LIMITS.title}
          autoFocus
          onChange={(e) => setTitle(e.target.value)}
          status={error ? 'bad' : undefined}
          message={error ?? undefined}
        />
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="quiet" onClick={close}>
            {common.cancel}
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? t.creating : t.create}
          </Button>
        </div>
      </form>
    </Sheet>
  );
}
