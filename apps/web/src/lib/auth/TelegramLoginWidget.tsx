import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authKeys } from './useAuth';
import { loginWithWidget } from './authApi';

declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramWidgetUser) => void;
  }
}

interface TelegramWidgetUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  auth_date: number;
  hash: string;
}

const BOT_USERNAME = import.meta.env.VITE_TELEGRAM_BOT_USERNAME;

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
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    if (!BOT_USERNAME) {
      setScriptFailed(true);
      return;
    }

    window.onTelegramAuth = (user: TelegramWidgetUser) => {
      void loginWithWidget(user).then((session) => {
        queryClient.setQueryData(authKeys.me(), session.user);
      });
    };

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', BOT_USERNAME);
    script.setAttribute('data-size', 'large');
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.async = true;
    script.onerror = () => setScriptFailed(true);

    containerRef.current?.appendChild(script);

    return () => {
      delete window.onTelegramAuth;
      containerRef.current?.replaceChildren();
    };
  }, [queryClient]);

  if (scriptFailed) {
    return (
      <p className="text-sm text-ember">
        Telegram sign-in didn't load. Check your connection and reload the page.
      </p>
    );
  }

  return <div ref={containerRef} />;
}
