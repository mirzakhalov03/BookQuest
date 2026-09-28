import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';
import { authKeys } from '@/lib/auth/useAuth';
import { linkTelegram } from '@/lib/auth/authApi';

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

type State = 'idle' | 'linking' | 'error' | 'script-failed';

/**
 * The deferred half of email/password sign-up: once the app's Telegram
 * domain is registered with @BotFather, an email/password user can attach
 * their Telegram identity here without creating a second account.
 */
export function ConnectTelegram() {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [state, setState] = useState<State>('idle');

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
        .catch(() => setState('error'));
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
      <p className="type-label">Connect Telegram</p>
      <p className="max-w-sm text-taupe-dim">
        Link your Telegram account for a faster sign-in next time.
      </p>
      <div ref={containerRef} />
      {state === 'linking' && <p className="text-sm text-paper-dim">Connecting…</p>}
      {state === 'error' && (
        <p className="text-sm text-ember">Telegram confirmed you, but connecting failed. Try again.</p>
      )}
    </section>
  );
}
