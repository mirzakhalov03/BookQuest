import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';
import { ApiRequestError } from '@/lib/api/client';
import { errorMessage } from '@/lib/api/errorMessage';
import { authKeys } from '@/lib/auth/useAuth';
import { linkTelegram } from '@/lib/auth/authApi';
import { useT } from '@/i18n';

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

type State = 'idle' | 'linking' | 'error' | 'script-failed';


/**
 * The deferred half of phone/password sign-up: once the app's Telegram
 * domain is registered with @BotFather, a phone/password user can attach
 * their Telegram identity here without creating a second account.
 */
export function ConnectTelegram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>('idle');
  const t = useT().profile;
  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    if (!BOT_USERNAME) {
      setState('script-failed');
      return;
    }

    window.onTelegramAuth = (payload: TelegramWidgetAuthPayload) => {
      setState('linking');
      void linkTelegram(payload)
        .then((user) => {
          queryClient.setQueryData(authKeys.me(), user);
        })
        .catch((error: unknown) => {
          // Most likely real failure: this Telegram account is already the
          // Mini App identity of a different user — the server says so
          // ("already connected to a different user"), and "try again"
          // would be wrong advice for that case.
          setLinkError(error instanceof ApiRequestError ? errorMessage(error) : null);
          setState('error');
        });
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    script.onerror = () => setState('script-failed');

    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      containerRef.current?.replaceChildren();
    };
  }, [queryClient]);

  if (state === 'script-failed') return null;

  return (
    <section className="flex flex-col gap-3">
      {/* Accented like `Button`'s primary variant, since the Telegram widget
          below is drawn by Telegram's own script — no color option in its
          API — so the accent goes on the one thing here that's actually
          ours. */}
      <p className="type-label text-ember">{t.connectTelegram}</p>
      <p className="max-w-sm text-taupe-dim">{t.connectTelegramBody}</p>
      <div ref={containerRef} />
      {state === 'linking' && <p className="text-sm text-paper-dim">{t.connecting}</p>}
      {state === 'error' && <p className="text-sm text-ember">{linkError ?? t.connectFailed}</p>}
    </section>
  );
}
