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
          showToast('Broadcast on its way.');
        },
        onSettled: () => setConfirming(false)
      }
    );
  }

  return (
    <AdminScreen className="max-w-3xl">
      <AdminPageHeader eyebrow="Broadcast" title="Message everyone" />

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
          label="Message"
          rows={5}
          maxLength={BROADCAST_MAX_LENGTH}
          placeholder="The quiz opens tomorrow at 18:00."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          head={
            <span className={`text-xs tabular-nums ${nearLimit ? 'text-error' : 'text-taupe-dim'}`}>
              {formatCount(message.length)} / {formatCount(BROADCAST_MAX_LENGTH)}
            </span>
          }
          status={send.isError ? 'bad' : undefined}
          message={send.isError ? send.error.message : undefined}
        />

        {trimmed && <MessagePreview message={trimmed} />}

        {reach && (
          <p className="m-0 text-sm text-taupe">
            Reaches {formatCount(reach.audience)} people · {formatCount(reach.dmAudience)} on Telegram
          </p>
        )}

        <Button type="submit" disabled={!trimmed || send.isPending} className="self-stretch sm:self-start">
          Send to everyone
        </Button>
      </form>

      <BroadcastHistory query={broadcasts} />

      <Sheet
        open={confirming}
        onClose={() => setConfirming(false)}
        title="Send this to everyone?"
        actions={
          <>
            <Button type="button" variant="quiet" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={confirmSend} disabled={send.isPending}>
              {send.isPending ? 'Sending…' : 'Send now'}
            </Button>
          </>
        }
      >
        <MessagePreview message={trimmed} />
        {reach && (
          <p className="m-0 text-sm text-taupe">
            It reaches {formatCount(reach.audience)} people in the app, {formatCount(reach.dmAudience)} of them on
            Telegram too. It can't be unsent.
          </p>
        )}
      </Sheet>
    </AdminScreen>
  );
}
