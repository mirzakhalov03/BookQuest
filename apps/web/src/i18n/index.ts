import { z } from 'zod';
import zodEn from 'zod/v4/locales/en.js';
import zodUz from 'zod/v4/locales/uz.js';
import zodRu from 'zod/v4/locales/ru.js';
import { useLocaleStore } from '@/stores/locale.store';
import { en, type Messages } from './en';
import { uz } from './uz';
import { ru } from './ru';
import type { Locale } from './locales';

export type { Messages } from './en';
export * from './locales';

const MESSAGES: Record<Locale, Messages> = { en, uz, ru };

// Zod's own wording for schema defaults (a too-long field the app didn't give a message for).
const ZOD_LOCALES: Record<Locale, () => Parameters<typeof z.config>[0]> = { en: zodEn, uz: zodUz, ru: zodRu };

/** The dictionary for the current language; re-renders the caller when it changes. */
export function useT(): Messages {
  return MESSAGES[useLocaleStore((state) => state.locale)];
}

export function useLocale(): Locale {
  return useLocaleStore((state) => state.locale);
}

/** Outside render (toasts in callbacks, formatters): reads the current language without subscribing. */
export function getT(): Messages {
  return MESSAGES[useLocaleStore.getState().locale];
}

export function getLocale(): Locale {
  return useLocaleStore.getState().locale;
}

/** Resolves the language before the first paint and keeps `<html lang>` in step for screen readers and hyphenation. */
export function initI18n(): void {
  const sync = (locale: Locale) => {
    document.documentElement.setAttribute('lang', locale);
    z.config(ZOD_LOCALES[locale]());
  };
  useLocaleStore.getState().init();
  sync(getLocale());
  useLocaleStore.subscribe((state, prev) => {
    if (state.locale !== prev.locale) sync(state.locale);
  });
}
