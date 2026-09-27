import { useState } from 'react';
import { AdminScreen } from '@/layouts/AdminLayout';
import { useSendBroadcast } from './api/useSendBroadcast';

export function BroadcastPage() {
  const [message, setMessage] = useState('');
  const sendBroadcast = useSendBroadcast();

  return (
    <AdminScreen>
      <h1 className="type-display text-2xl text-paper">Broadcast</h1>
      <form
        className="flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!message.trim()) return;
          sendBroadcast.mutate(
            { message },
            { onSuccess: () => setMessage('') }
          );
        }}
      >
        <textarea
          className="min-h-32 rounded-[3px] border border-[color:var(--rule)] bg-[color:var(--color-ash)] p-3 text-paper"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={1000}
          placeholder="Quiz opens tomorrow at 6pm!"
        />
        <button
          type="submit"
          disabled={sendBroadcast.isPending || !message.trim()}
          className="rounded-[3px] bg-ember px-4 py-2 text-paper disabled:opacity-50"
        >
          {sendBroadcast.isPending ? 'Sending…' : 'Send to everyone'}
        </button>
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
