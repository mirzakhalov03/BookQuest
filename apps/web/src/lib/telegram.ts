/**
 * A thin, safe view of the Telegram Mini App bridge. Every call must work on the
 * plain web too. Nothing here authenticates: `initData` is trusted only after the API verifies it.
 * Hand-rolled, not `@telegram-apps/sdk`: this small surface doesn't pay for the SDK.
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
  /** Never read (spec §9): the identity is fixed dark; we push our colours *to* Telegram instead. */
  themeParams: Record<string, string>;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  requestFullscreen?: () => void;
  isFullscreen?: boolean;
  enableClosingConfirmation?: () => void;
  openLink?: (url: string) => void;
  openTelegramLink?: (url: string) => void;
  /** Deliberately unused: the primary action belongs to the stage composition (spec §9). Don't wire it up. */
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

/** Not `window.Telegram.WebApp`: the script loads on the open web too, so only the signed payload tells them apart. */
export const isInsideTelegram = (): boolean => getInitData() !== null;

/** Called once at start-up. Outside Telegram it does nothing. */
export function initTelegram(): void {
  const webApp = getTelegramWebApp();
  if (!webApp) return;

  webApp.ready();
  webApp.expand();
  // Unsupported methods exist but throw `WebAppMethodUnsupported` on some builds, hence the try/catch.
  try {
    webApp.requestFullscreen?.();
  } catch {
    // expand() above already ran.
  }
  // Telegram can't block the swipe-to-close; asking for confirmation is the ceiling.
  try {
    webApp.enableClosingConfirmation?.();
  } catch {
    // Unsupported on this client build.
  }
  webApp.setHeaderColor?.('#14100C');
  webApp.setBackgroundColor?.('#14100C');
}

/** The signed payload the API needs in order to trust who is calling. */
export function getInitData(): string | null {
  return getTelegramWebApp()?.initData || null;
}

/** Who Telegram says is using the app. Unverified — only for choosing whether to sign in again. */
export function getInitDataUserId(): string | null {
  const initData = getInitData();
  if (!initData) return null;
  try {
    const user = JSON.parse(new URLSearchParams(initData).get('user') ?? 'null') as { id?: unknown } | null;
    return user?.id == null ? null : String(user.id);
  } catch {
    return null;
  }
}

/** Telegram's header back button; `null` on the web or old clients. Screens use `useTelegramBackButton`. */
export function getTelegramBackButton(): TelegramBackButton | null {
  return getTelegramWebApp()?.BackButton ?? null;
}

/** Named for what happened, not the Telegram method behind it. */
export type HapticMoment =
  /** A tab, a toggle — the lightest acknowledgement. */
  | 'select'
  /** The primary action: joining, submitting, entering the quiz. */
  | 'action'
  /** The participant number landing. The one celebratory buzz in the app. */
  | 'reveal'
  /** A rejected value or a refused request. */
  | 'error';

/** No-op outside Telegram. Desktop throws for unsupported methods; a missed buzz must not break a click. */
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
    // Nothing to fall back to.
  }
}

/** Opens a URL outside the sheet; `false` means let a plain link handle it (always, on the web). */
export function openExternalLink(url: string): boolean {
  // The method exists on the web too (as window.open); only inside the sheet is there anything to open out of.
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

/** A t.me link opened from inside the sheet stays inside Telegram; `false` means use a plain link. */
export function openTelegramLink(url: string): boolean {
  if (!isInsideTelegram()) return false;

  const open = getTelegramWebApp()?.openTelegramLink;
  if (!open) return false;

  try {
    open(url);
    return true;
  } catch {
    return false;
  }
}
