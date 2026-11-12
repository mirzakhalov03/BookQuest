import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { QUIZ_TEXT_LIMITS, groupLabels, type QuizAdmin, type QuizCorrectionPayload } from '@bookquest/shared';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { TextArea } from '@/components/ui/TextArea';
import { ApiRequestError } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui.store';
import { useQuizCorrection } from '../../api/useQuizCorrection';
import { CharCount } from './CharCount';

type Mode = QuizCorrectionPayload['kind'];

const MODE_OPTIONS = [
  { value: 'key', label: 'Change answer' },
  { value: 'void', label: 'Void question' }
] as const;

// A different word per action, so muscle memory from one can't confirm the other.
const CONFIRM_WORD: Record<Mode, string> = { key: 'CHANGE', void: 'VOID' };
const SINGLE_LABEL = groupLabels('single', 1)[0];

interface CorrectionSheetProps {
  quiz: QuizAdmin;
  /** The question being corrected; null keeps the sheet closed. */
  questionId: string | null;
  onClose: () => void;
}

/** §5.5: pick a new correct option or void the question; the server re-scores every attempt. */
export function CorrectionSheet({ quiz, questionId, onClose }: CorrectionSheetProps) {
  const [mode, setMode] = useState<Mode>('key');
  const [picked, setPicked] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const correction = useQuizCorrection(quiz.id);
  const showToast = useUiStore((state) => state.showToast);

  const index = quiz.questions.findIndex((q) => q.id === questionId);
  const question = quiz.questions[index];
  const counting = quiz.questions.length - quiz.voidedQuestionIds.length;
  const hasSiblings = quiz.attachment !== null && quiz.attachment.groupLabel !== SINGLE_LABEL;
  const changesKey = picked !== null && picked !== question?.correctOptionId;
  const ready = (mode === 'void' || changesKey) && confirm === CONFIRM_WORD[mode];

  function close() {
    setMode('key');
    setPicked(null);
    setNote('');
    setConfirm('');
    setError(null);
    onClose();
  }

  async function submit() {
    if (!question) return;
    setError(null);
    const base = { questionId: question.id, ...(note.trim() ? { note: note.trim() } : {}) };
    try {
      const { rescored } = await correction.mutateAsync(
        mode === 'key' ? { ...base, kind: 'key', correctOptionId: picked! } : { ...base, kind: 'void' }
      );
      showToast(rescored === 0 ? 'Already corrected; nothing to re-score.' : `Re-scored ${rescored} ${rescored === 1 ? 'attempt' : 'attempts'}.`);
      close();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : FALLBACK_MESSAGE);
    }
  }

  return (
    <Sheet
      open={question !== undefined}
      onClose={close}
      title={`Correct question ${index + 1}`}
      actions={
        <>
          <Button type="button" variant="quiet" onClick={close}>
            Cancel
          </Button>
          <Button type="button" disabled={!ready || correction.isPending} onClick={() => void submit()}>
            {correction.isPending ? 'Re-scoring…' : mode === 'key' ? 'Change and re-score' : 'Void and re-score'}
          </Button>
        </>
      }
    >
      {question && (
        <>
          <p className="m-0 text-paper-dim">{question.prompt}</p>
          <Segmented
            aria-label="Correction"
            options={MODE_OPTIONS}
            value={mode}
            onChange={(next: Mode) => {
              setMode(next);
              setConfirm('');
              setError(null);
            }}
          />

          {mode === 'key' ? (
            <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
              <legend className="type-label mb-1 p-0">New correct answer</legend>
              {question.options.map((option) => {
                const isCurrent = option.id === question.correctOptionId;
                return (
                  <label
                    key={option.id}
                    className={`flex min-h-11 items-center gap-3 rounded-box border px-3 py-2 ${
                      picked === option.id ? 'border-amber/60' : 'border-[color:var(--rule)]'
                    } ${isCurrent ? 'text-taupe' : 'cursor-pointer text-paper'}`}
                  >
                    <input
                      type="radio"
                      name="correction-key"
                      checked={picked === option.id}
                      disabled={isCurrent}
                      onChange={() => setPicked(option.id)}
                      className="h-5 w-5 shrink-0 accent-[color:var(--color-ember)]"
                    />
                    <span className="min-w-0 flex-1">{option.text}</span>
                    {isCurrent && <span className="shrink-0 text-xs">Current</span>}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <>
              <p className="m-0 text-taupe">
                Removed from the score and total of everyone on this quiz: they are scored out of {counting - 1}{' '}
                instead of {counting}.
              </p>
              {hasSiblings && (
                <p role="note" className="m-0 flex items-start gap-2 rounded-box border border-amber/40 p-3 text-sm text-amber">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    This quiz is one variant ({quiz.attachment!.groupLabel}) of a shared leaderboard, so totals will differ
                    between variants. To keep them even, also void a {question.difficulty} question on the other variant, or
                    accept the mismatch.
                  </span>
                </p>
              )}
            </>
          )}

          <TextArea
            label="Note (optional)"
            value={note}
            rows={2}
            maxLength={QUIZ_TEXT_LIMITS.voidReason}
            head={<CharCount length={note.length} max={QUIZ_TEXT_LIMITS.voidReason} />}
            onChange={(e) => setNote(e.target.value)}
          />
          <Field
            label={`Type ${CONFIRM_WORD[mode]} to confirm`}
            value={confirm}
            autoComplete="off"
            onChange={(e) => setConfirm(e.target.value)}
            status={error ? 'bad' : undefined}
            message={error ?? undefined}
          />
        </>
      )}
    </Sheet>
  );
}
