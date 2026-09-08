/**
 * A thin, safe view of the Telegram Mini App bridge.
 *
 * The app also runs as a plain website, so every call has to work when the
 * bridge is absent. Nothing here authenticates anyone — `initData` is only
 * trustworthy once the API verifies its signature.
 */

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  colorScheme: 'light' | 'dark';
  themeParams: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

export const isTelegramMiniApp = (): boolean => getTelegramWebApp() !== null;

/** Called once at start-up. Outside Telegram it does nothing. */
export function initTelegram(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  webApp.setHeaderColor?.('#14100C');
  webApp.setBackgroundColor?.('#14100C');
}

/** The signed payload the API needs in order to trust who is calling. */
export function getInitData(): string | null {
  return getTelegramWebApp()?.initData || null;
}
