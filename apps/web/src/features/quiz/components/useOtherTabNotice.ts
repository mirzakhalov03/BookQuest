import { useCallback, useEffect, useRef, useState } from 'react';

type Message = 'hello' | 'here' | 'takeover';

const CHANNEL = 'bq-quiz';

/**
 * Another tab of this browser has the quiz open (§6). UX only: the server is
 * authoritative either way. Missing in older iOS webviews, so it's feature-detected.
 */
export function useOtherTabNotice(onTakeOver: () => void): { show: boolean; takeOver: () => void } {
  const [show, setShow] = useState(false);
  const channel = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    let bc: BroadcastChannel;
    try {
      bc = new BroadcastChannel(CHANNEL);
    } catch {
      return;
    }
    channel.current = bc;
    const post = (message: Message) => bc.postMessage(message);
    bc.onmessage = (event: MessageEvent<Message>) => {
      // A newcomer says hello; we answer so it knows about us too. No reply to `here`/`takeover`, so no ping-pong.
      if (event.data === 'hello') post('here');
      setShow(true);
    };
    post('hello');
    return () => {
      bc.close();
      channel.current = null;
    };
  }, []);

  const takeOver = useCallback(() => {
    setShow(false);
    channel.current?.postMessage('takeover' satisfies Message);
    onTakeOver();
  }, [onTakeOver]);

  return { show, takeOver };
}
