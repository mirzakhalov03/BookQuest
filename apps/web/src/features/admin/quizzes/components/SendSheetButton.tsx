import { Check, Send } from 'lucide-react';
import { useEffect } from 'react';
import { Spinner } from '@/components/ui/Spinner';
import { ApiRequestError } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui.store';
import { useSendAnswerSheet } from '../../api/useQuizLive';

const SENT_TICK_MS = 2500;

interface SendSheetButtonProps {
  attemptId: string;
  who: string;
  /** `icon` for a table row, `labelled` where there is room to say what it does. */
  look?: 'icon' | 'labelled';
}

/** Sends the attempt's full answer sheet to your own Telegram. Each button owns its mutation, so rows don't share a spinner. */
export function SendSheetButton({ attemptId, who, look = 'icon' }: SendSheetButtonProps) {
  const send = useSendAnswerSheet();
  const showToast = useUiStore((state) => state.showToast);

  // The tick is brief confirmation, then the button is ready to send again.
  useEffect(() => {
    if (!send.isSuccess) return;
    const timer = setTimeout(() => send.reset(), SENT_TICK_MS);
    return () => clearTimeout(timer);
  }, [send.isSuccess]); // eslint-disable-line react-hooks/exhaustive-deps

  function onClick() {
    send.mutate(attemptId, {
      onSuccess: () => showToast('Answer sheet sent to your Telegram.'),
      onError: (error) => showToast(error instanceof ApiRequestError ? error.message : 'Could not send the answer sheet.')
    });
  }

  const icon = send.isPending ? (
    <Spinner />
  ) : send.isSuccess ? (
    <Check aria-hidden className="h-4 w-4 text-gold-soft" />
  ) : (
    <Send aria-hidden className="h-4 w-4" />
  );

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={send.isPending}
      aria-label={`Send ${who}'s answer sheet to Telegram`}
      title="Send answer sheet to Telegram"
      className={
        look === 'icon'
          ? 'grid h-9 w-9 shrink-0 place-items-center rounded-box text-taupe hover:text-paper disabled:opacity-60'
          : 'inline-flex min-h-11 items-center gap-2 rounded-box px-3 text-sm text-taupe hover:text-paper disabled:opacity-60'
      }
    >
      {icon}
      {look === 'labelled' && <span>Send to Telegram</span>}
    </button>
  );
}
