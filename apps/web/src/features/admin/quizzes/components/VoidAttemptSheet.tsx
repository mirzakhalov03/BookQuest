import { useState } from 'react';
import { QUIZ_TEXT_LIMITS } from '@bookquest/shared';
import { FALLBACK_MESSAGE } from '@/components/feedback/ErrorState';
import { Button } from '@/components/ui/Button';
import { Field } from '@/components/ui/Field';
import { Sheet } from '@/components/ui/Sheet';
import { TextArea } from '@/components/ui/TextArea';
import { ApiRequestError } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui.store';
import { useVoidAttempt } from '../../api/useQuizLive';

const CONFIRM_WORD = 'VOID';

interface VoidAttemptSheetProps {
  attemptId: string;
  /** "#3004 Dilnoza K." — what the admin is about to void. */
  who: string;
  open: boolean;
  onClose: () => void;
  onVoided: () => void;
}

/** A reason (shown to the participant) plus a typed word, because this can't be undone. */
export function VoidAttemptSheet({ attemptId, who, open, onClose, onVoided }: VoidAttemptSheetProps) {
  const [reason, setReason] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const voidAttempt = useVoidAttempt(attemptId);
  const showToast = useUiStore((state) => state.showToast);

  const ready = reason.trim().length > 0 && confirm === CONFIRM_WORD;

  function close() {
    setReason('');
    setConfirm('');
    setError(null);
    onClose();
  }

  async function submit() {
    setError(null);
    try {
      await voidAttempt.mutateAsync({ reason: reason.trim() });
      showToast('Attempt voided.');
      close();
      onVoided();
    } catch (e) {
      setError(e instanceof ApiRequestError ? e.message : FALLBACK_MESSAGE);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      title="Void this attempt?"
      actions={
        <>
          <Button type="button" variant="quiet" onClick={close}>
            Keep it
          </Button>
          <Button type="button" disabled={!ready || voidAttempt.isPending} onClick={() => void submit()}>
            {voidAttempt.isPending ? 'Voiding…' : 'Void attempt'}
          </Button>
        </>
      }
    >
      <p className="m-0 text-taupe">
        {who}’s result is removed from the leaderboard and the attempt is kept for the record. They see the reason below.
      </p>
      <TextArea
        label="Reason"
        value={reason}
        maxLength={QUIZ_TEXT_LIMITS.voidReason}
        rows={3}
        onChange={(e) => setReason(e.target.value)}
      />
      <Field
        label={`Type ${CONFIRM_WORD} to confirm`}
        value={confirm}
        autoComplete="off"
        onChange={(e) => setConfirm(e.target.value)}
        status={error ? 'bad' : undefined}
        message={error ?? undefined}
      />
    </Sheet>
  );
}
