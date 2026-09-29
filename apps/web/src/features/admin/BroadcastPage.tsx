import { useState } from 'react';
import { AdminScreen } from '@/layouts/AdminLayout';
import { useSendBroadcast } from './api/useSendBroadcast';

export function BroadcastPage() {
  const [message, setMessage] = useState('');
  // A second, deliberate tap before the one action here that can't be undone
  // (spec-scale: "hundreds" of real DMs) — reset the moment the message
  // changes, so confirming stays tied to the text actually being sent.
  const [confirming, setConfirming] = useState(false);
  const sendBroadcast = useSendBroadcast();

  return (
    <AdminScreen>
      <h1 className="type-display text-2xl text-paper">Broadcast</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim()) return;

          if (!confirming) {
            setConfirming(true);
            return;
          }

          sendBroadcast.mutate(
            { message },
            { onSuccess: () => setMessage('') }
          );
          setConfirming(false);
        }}
      >
        <textarea
          className="min-h-32 rounded-box border border-[color:var(--rule)] bg-[color:var(--color-ash)] p-3 text-paper"
          value={message}
          onChange={(event) => {
            setMessage(event.target.value);
            setConfirming(false);
          }}
          maxLength={1000}
          placeholder="Quiz opens tomorrow at 6pm!"
        />
        {confirming ? (
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={sendBroadcast.isPending}
              className="rounded-box bg-ember px-4 py-2 text-paper disabled:opacity-50"
            >
              {sendBroadcast.isPending ? 'Sending…' : 'Confirm: send to everyone'}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              className="text-sm text-taupe"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            type="submit"
            disabled={!message.trim()}
            className="rounded-box bg-ember px-4 py-2 text-paper disabled:opacity-50"
          >
            Send to everyone
          </button>
        )}
        {sendBroadcast.isSuccess && (
          <p className="text-sm text-taupe">
            Sent to {sendBroadcast.data.recipientCount} people.
          </p>
        )}
        {sendBroadcast.isError && (
          <p className="text-sm text-ember">{sendBroadcast.error.message}</p>
        )}
      </form>
    </AdminScreen>
  );
}
