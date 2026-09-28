import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { TelegramWidgetAuthPayload } from '@bookquest/shared';
import { setSessionUser } from './useAuth';
import { loginWithWidget } from './authApi';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetAuthPayload) => void;
  }
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

type WidgetState = 'idle' | 'signing-in' | 'error' | 'script-failed';

/**
 * Telegram's Login Widget is a `<script>` tag Telegram's own servers render
 * into a button; there is no npm package, and no props to pass it beyond
 * data attributes. `data-onauth` names a *global* function, not a React
 * callback — that impedance is the whole reason this is its own component
 * rather than inline JSX.
 */
export function TelegramLoginWidget() {
  const containerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [state, setState] = useState<WidgetState>('idle');

  useEffect(() => {
    if (!BOT_USERNAME) {
      setState('script-failed');
      return;
    }

    window.onTelegramAuth = (user: TelegramWidgetAuthPayload) => {
      setState('signing-in');
      void loginWithWidget(user)
        .then((session) => {
          setSessionUser(queryClient, session.user);
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

  if (state === 'script-failed') {
    return (
      <p className="text-sm text-ember">
        Telegram sign-in didn't load. Check your connection and reload the page.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      <div ref={containerRef} />
      {state === 'signing-in' && <p className="text-sm text-paper-dim">Signing in…</p>}
      {state === 'error' && (
        <p className="text-sm text-ember">
          Telegram confirmed you, but we couldn't sign you in. Try the button again.
        </p>
      )}
    </div>
  );
}
