import { useState } from 'react';
import { useLocation } from 'react-router';
import { BROADCAST_MAX_LENGTH } from '@bookquest/shared';
import { AdminScreen } from '@/layouts/AdminLayout';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { useCurrentQuest } from '@/lib/api/quest';
import { formatCount } from '@/lib/format';
import { useUiStore } from '@/stores/ui.store';
import { useBroadcasts } from '../api/useBroadcasts';
import { useSendBroadcast } from '../api/useSendBroadcast';
import { AdminPageHeader } from '../components/AdminPageHeader';
import { BroadcastHistory } from './components/BroadcastHistory';
import { MessagePreview } from './components/MessagePreview';
import { broadcastSuggestions } from './suggestions';
import { useT } from '@/i18n';
import { errorMessage } from '@/lib/api/errorMessage';

/** Router state other screens hand over to pre-fill the composer (the Dashboard's next steps). */
export interface BroadcastLocationState {
  draft?: string;
}

export function BroadcastPage() {
  const location = useLocation();
  const [message, setMessage] = useState(() => (location.state as BroadcastLocationState | null)?.draft ?? '');
  const [confirming, setConfirming] = useState(false);
  const broadcasts = useBroadcasts();
  const quest = useCurrentQuest();
  const send = useSendBroadcast();
  const showToast = useUiStore((state) => state.showToast);
  const t = useT();
  const b = t.admin.broadcast;

  const trimmed = message.trim();
  const suggestions = quest.data ? broadcastSuggestions(quest.data, new Date()) : [];
  const reach = broadcasts.data;
  const nearLimit = message.length >= BROADCAST_MAX_LENGTH * 0.9;

  function confirmSend() {
    send.mutate(
      { message: trimmed },
      {
        onSuccess: () => {
          setMessage('');
          showToast(b.sentToast);
        },
        onSettled: () => setConfirming(false)
      }
    );
  }

  return (
    <AdminScreen className="max-w-3xl">
      <AdminPageHeader eyebrow={b.eyebrow} title={b.title} />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed) setConfirming(true);
        }}
        className="flex flex-col gap-4"
      >
        {suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion.label}
                type="button"
                onClick={() => setMessage(suggestion.message)}
                className="min-h-9 rounded-chip border border-[color:var(--rule)] px-3 text-sm text-paper-dim transition-colors hover:border-[color:var(--color-ember)] hover:text-paper"
              >
                {suggestion.label}
              </button>
            ))}
          </div>
        )}

        <TextArea
          label={b.message}
          rows={5}
          maxLength={BROADCAST_MAX_LENGTH}
          placeholder={b.placeholder}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          head={
            <span className={`text-xs tabular-nums ${nearLimit ? 'text-error' : 'text-taupe-dim'}`}>
              {formatCount(message.length)} / {formatCount(BROADCAST_MAX_LENGTH)}
            </span>
          }
          status={send.isError ? 'bad' : undefined}
          message={send.isError ? errorMessage(send.error) : undefined}
        />

        {trimmed && <MessagePreview message={trimmed} />}

        {reach && (
          <p className="m-0 text-sm text-taupe">
            {b.reach(formatCount(reach.audience), formatCount(reach.dmAudience))}
          </p>
        )}

        <Button type="submit" disabled={!trimmed || send.isPending} className="self-stretch sm:self-start">
          {b.sendToEveryone}
        </Button>
      </form>

      <BroadcastHistory query={broadcasts} />

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title={b.confirmTitle}
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              {t.common.cancel}
            </Button>
            <Button type="button" onClick={confirmSend} disabled={send.isPending}>
              {send.isPending ? b.sending : b.sendNow}
            </Button>
          </>
        }
      >
        <MessagePreview message={trimmed} />
        {reach && (
          <p className="m-0 text-sm text-taupe">
            {b.confirmBody(formatCount(reach.audience), formatCount(reach.dmAudience))}
          </p>
        )}
      </Sheet>
    </AdminScreen>
  );
}
