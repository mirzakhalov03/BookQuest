import { getTelegramLanguageCode } from '@/lib/telegram';

export const LOCALES = ['en', 'uz', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = 'en';

/** Each language named in itself, so a reader who can't read the current one still finds theirs. */
export const LOCALE_NAMES: Record<Locale, string> = {
  en: 'English',
  uz: 'O‘zbekcha',
  ru: 'Русский'
};

/** BCP 47 tags handed to `Intl`. `en-GB` keeps day-first dates and the 24-hour clock the design uses. */
export const INTL_LOCALES: Record<Locale, string> = {
  en: 'en-GB',
  uz: 'uz-Latn',
  ru: 'ru'
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && (LOCALES as readonly string[]).includes(value);
}

/** "uz-Latn", "ru-RU", "EN" → a supported locale, or `null`. */
export function toLocale(code: string | null | undefined): Locale | null {
  const primary = code?.trim().toLowerCase().split(/[-_]/)[0];
  return isLocale(primary) ? primary : null;
}

/** Telegram's client language first; the browser's on the open web; English when neither is supported. */
export function detectLocale(): Locale {
  const telegram = getTelegramLanguageCode();
  if (telegram !== null) return toLocale(telegram) ?? DEFAULT_LOCALE;

  const browser = typeof navigator === 'undefined' ? [] : (navigator.languages ?? [navigator.language]);
  for (const code of browser) {
    const locale = toLocale(code);
    if (locale) return locale;
  }
  return DEFAULT_LOCALE;
}
