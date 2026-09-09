import { mockControls, type MockControls } from './store';
import { installMockTransport } from './transport';

/**
 * Development scaffolding: the API contract, served from the browser.
 *
 * The whole thing is reachable only through the guarded dynamic import in
 * `main.tsx`, so deleting it is `rm -rf lib/api/mock` plus that one `if`.
 * Nothing else in the app imports it, and nothing in it imports a component.
 */

declare global {
  interface Window {
    /** Present only in mock mode. See the report for what each control does. */
    mockApi?: MockControls;
  }
}

export function installMockApi(): void {
  installTelegramBridge();
  installMockTransport();
  window.mockApi = mockControls;

  console.info(
    '%c[mock]%c BookQuest is answering from fixtures — none of this data is real.\n' +
      'Controls: window.mockApi.setRole(…), .setPhase(…), .setQuestRunning(…), .publishResults(), .reset(), .state()',
    'font-weight:700;color:#e0a458',
    'color:inherit'
  );
}

type TelegramBridge = NonNullable<NonNullable<Window['Telegram']>['WebApp']>;

/** A signed payload never leaves the mock, so its contents do not matter. */
const MOCK_INIT_DATA = 'mock-init-data';

/**
 * The other half of "no session outside Telegram".
 *
 * The boot only runs the sign-in exchange when the bridge hands it an
 * `initData` string, and a plain browser's bridge hands back an empty one —
 * so without this the mock would serve a session nobody ever asks for.
 * Standing in for Telegram here, rather than branching inside the auth layer,
 * means every line of the session code runs exactly the path it takes in the
 * real Mini App. The real bridge is delegated to, not replaced, so theme
 * colours and `ready()` still reach Telegram when there is a Telegram.
 */
function installTelegramBridge(): void {
  const real = window.Telegram?.WebApp ?? null;

  const bridge: TelegramBridge = {
    ready: () => real?.ready(),
    expand: () => real?.expand(),
    initData: MOCK_INIT_DATA,
    colorScheme: real?.colorScheme ?? 'dark',
    themeParams: real?.themeParams ?? {},
    setHeaderColor: (color) => real?.setHeaderColor?.(color),
    setBackgroundColor: (color) => real?.setBackgroundColor?.(color)
  };

  window.Telegram = { WebApp: bridge };
}
