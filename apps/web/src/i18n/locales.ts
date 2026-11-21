export const LOCALES = ['en', 'uz', 'ru'] as const;
export type Locale = (typeof LOCALES)[number];

/** Everyone starts in Uzbek; only an explicit pick in Profile changes it. */
export const DEFAULT_LOCALE: Locale = 'uz';

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
