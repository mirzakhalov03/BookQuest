import { useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { QUIZ_TEXT_LIMITS, groupLabels, type QuizAdmin, type QuizCorrectionPayload } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Segmented } from '@/components/ui/Segmented';
import { Sheet } from '@/components/ui/Sheet';
import { TextArea } from '@/components/ui/TextArea';
import { useUiStore } from '@/stores/ui.store';
import { useQuizCorrection } from '../../api/useQuizCorrection';
import { CharCount } from './CharCount';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';
import { localizeGroupLabel } from '../../quest/quizConfig';

type Mode = QuizCorrectionPayload['kind'];

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
  const { common, adminQuiz } = useT();
  const t = adminQuiz.correction;
  // A different word per action, so muscle memory from one can't confirm the other.
  const confirmWord = t.confirmWord;
  const modeOptions = [
    { value: 'key', label: t.changeAnswer },
    { value: 'void', label: t.voidQuestion }
  ] as const;

  const index = quiz.questions.findIndex((q) => q.id === questionId);
  const question = quiz.questions[index];
  const counting = quiz.questions.length - quiz.voidedQuestionIds.length;
  const hasSiblings = quiz.attachment !== null && quiz.attachment.groupLabel !== SINGLE_LABEL;
  const changesKey = picked !== null && picked !== question?.correctOptionId;
  const ready = (mode === 'void' || changesKey) && confirm === confirmWord[mode];

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
      showToast(rescored === 0 ? t.nothingToRescore : t.rescored(rescored));
      close();
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Sheet
      open={question !== undefined}
      onClose={close}
      title={t.title(index + 1)}
      actions={
        <>
          <Button type="button" variant="quiet" onClick={close}>
            {common.cancel}
          </Button>
          <Button type="button" disabled={!ready || correction.isPending} onClick={() => void submit()}>
            {correction.isPending ? t.rescoring : mode === 'key' ? t.changeAndRescore : t.voidAndRescore}
          </Button>
        </>
      }
    >
      {question && (
        <>
          <p className="m-0 text-paper-dim">{question.prompt}</p>
          <Segmented
            aria-label={t.aria}
            options={modeOptions}
            value={mode}
            onChange={(next: Mode) => {
              setMode(next);
              setConfirm('');
              setError(null);
            }}
          />

          {mode === 'key' ? (
            <fieldset className="m-0 flex min-w-0 flex-col gap-1 border-0 p-0">
              <legend className="type-label mb-1 p-0">{t.newAnswer}</legend>
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
                    {isCurrent && <span className="shrink-0 text-xs">{t.current}</span>}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <>
              <p className="m-0 text-taupe">
                {t.voidBody(counting, counting - 1)}
              </p>
              {hasSiblings && (
                <p role="note" className="m-0 flex items-start gap-2 rounded-box border border-amber/40 p-3 text-sm text-amber">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    {t.siblings(localizeGroupLabel(quiz.attachment!.groupLabel), adminQuiz.difficulty[question.difficulty])}
                  </span>
                </p>
              )}
            </>
          )}

          <TextArea
            label={t.note}
            value={note}
            rows={2}
            maxLength={QUIZ_TEXT_LIMITS.voidReason}
            head={<CharCount length={note.length} max={QUIZ_TEXT_LIMITS.voidReason} />}
            onChange={(e) => setNote(e.target.value)}
          />
          <Field
            label={t.typeToConfirm(confirmWord[mode])}
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
