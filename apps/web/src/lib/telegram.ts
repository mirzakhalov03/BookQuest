/**
 * A thin, safe view of the Telegram Mini App bridge.
 *
 * The app also runs as a plain website, so every call has to work when the
 * bridge is absent. Nothing here authenticates anyone — `initData` is only
 * trustworthy once the API verifies its signature.
 *
 * This stays hand-rolled rather than pulling in `@telegram-apps/sdk` (spec §10
 * lists it as optional, "only if the bridge proves fiddly"): the whole surface
 * BookQuest uses is the four things below, each of them a call and a null
 * check. The SDK's value is its lifecycle and version negotiation, and neither
 * pays for itself against this much bridge.
 */

interface TelegramBackButton {
  show: () => void;
  hide: () => void;
  onClick: (handler: () => void) => void;
  offClick: (handler: () => void) => void;
}

type ImpactStyle = 'light' | 'medium' | 'heavy' | 'rigid' | 'soft';
type NotificationType = 'error' | 'success' | 'warning';

interface TelegramHapticFeedback {
  impactOccurred: (style: ImpactStyle) => void;
  notificationOccurred: (type: NotificationType) => void;
  selectionChanged: () => void;
}

interface TelegramWebApp {
  ready: () => void;
  expand: () => void;
  initData: string;
  colorScheme: 'light' | 'dark';
  /**
   * Deliberately never read (spec §9). BookQuest has a fixed dark identity —
   * warm brown-blacks, ember, gold — and adopting Telegram's light theme would
   * take the stage lighting with it. The traffic runs the other way: this app
   * pushes its header and background colours *to* Telegram in `initTelegram()`.
   */
  themeParams: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  enableClosingConfirmation?: () => void;
  openLink?: (url: string) => void;
  /**
   * Present, and deliberately unused. `MainButton` docks a button into
   * Telegram's own chrome at the bottom of the sheet. BookQuest's primary
   * action is part of the stage composition — it sits under the countdown,
   * inside the light, and carries the sub-line that says what happens next
   * (spec §9). Moving it into Telegram's chrome would strip it of all three and
   * leave a hole in the design. Do not "finish" this by wiring it up.
   */
  MainButton?: unknown;
  BackButton?: TelegramBackButton;
  HapticFeedback?: TelegramHapticFeedback;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  return window.Telegram?.WebApp ?? null;
}

/**
 * The honest test for "is this running inside Telegram".
 *
 * Not `window.Telegram.WebApp !== undefined` — `index.html` loads Telegram's
 * script on the open web too, so the object always exists and branching on it
 * makes read-only web mode unreachable. Only the signed payload tells the two
 * apart.
 */
export const isInsideTelegram = (): boolean => getInitData() !== null;

/** Called once at start-up. Outside Telegram it does nothing. */
export function initTelegram(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  // Newer clients support a real fullscreen request; expand() above is the
  // fallback every client understands. There is no feature-detection beyond
  // "does the method exist" — older clients simply don't have it.
  webApp.requestFullscreen?.();
  // The platform's actual ceiling for "hard to dismiss": Telegram has no API
  // to block the swipe-down/back-gesture close, only to ask for confirmation
  // before it happens.
  webApp.enableClosingConfirmation?.();
  webApp.setHeaderColor?.('#14100C');
  webApp.setBackgroundColor?.('#14100C');
}

/** The signed payload the API needs in order to trust who is calling. */
export function getInitData(): string | null {
  return getTelegramWebApp()?.initData || null;
}

/**
 * The hardware back button in Telegram's header. `null` on the web, and also
 * null in a Telegram client too old to have it — `useTelegramBackButton` in
 * `hooks/` is what screens actually use.
 */
export function getTelegramBackButton(): TelegramBackButton | null {
  return getTelegramWebApp()?.BackButton ?? null;
}

/**
 * The moments worth a haptic, named for what happened rather than for the
 * Telegram method — so a screen says `haptic('reveal')` and never has to know
 * that impacts and notifications are two different APIs.
 */
export type HapticMoment =
  /** A tab, a toggle — the lightest acknowledgement. */
  | 'select'
  /** The primary action: joining, submitting, entering the quiz. */
  | 'action'
  /** The participant number landing. The one celebratory buzz in the app. */
  | 'reveal'
  /** A rejected value or a refused request. */
  | 'error';

/**
 * A no-op outside Telegram, and a no-op in a client that predates haptics.
 *
 * The try/catch is not defensive padding: Telegram Desktop answers unsupported
 * bridge methods by throwing `WebAppMethodUnsupported`, and a buzz that cannot
 * be delivered must never take a button's click handler down with it.
 */
export function haptic(moment: HapticMoment): void {
  const feedback = getTelegramWebApp()?.HapticFeedback;
  if (!feedback) return;

  try {
    switch (moment) {
      case 'select':
        return feedback.selectionChanged();
      case 'action':
        return feedback.impactOccurred('medium');
      case 'reveal':
        return feedback.notificationOccurred('success');
      case 'error':
        return feedback.notificationOccurred('error');
    }
  } catch {
    // Unsupported on this client. There is nothing to fall back to and nothing
    // to tell the user — a haptic is the whole feature.
  }
}

/**
 * Opens a URL outside the Mini App sheet, and reports whether the bridge took
 * it. `false` means the caller should let a plain link do its own work — which
 * is exactly what happens on the web, where there is no sheet to leave.
 */
export function openExternalLink(url: string): boolean {
  // Not `openLink !== undefined`: the Telegram script is loaded on the open web
  // too and defines the method there, where it degrades to `window.open`. Only
  // inside the sheet is there anywhere to open *out of* — everywhere else the
  // browser should handle its own link, with its own middle-click and its own
  // "open in new tab".
  if (!isInsideTelegram()) return false;

  const openLink = getTelegramWebApp()?.openLink;
  if (!openLink) return false;

  try {
    openLink(url);
    return true;
  } catch {
    return false;
  }
}
