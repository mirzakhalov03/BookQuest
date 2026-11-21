import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DEFAULT_LOCALE, isLocale, type Locale } from '@/i18n/locales';

interface LocaleState {
  /** What the interface speaks right now. */
  locale: Locale;
  /** Set only by an explicit pick in Profile; until then the app speaks Uzbek. */
  chosen: Locale | null;
  setLocale: (locale: Locale) => void;
  /** Called once before the first render, after the Telegram bridge exists. */
  init: () => void;
}

export const useLocaleStore = create<LocaleState>()(
  persist(
    (set, get) => ({
      locale: DEFAULT_LOCALE,
      chosen: null,
      setLocale: (locale) => set({ locale, chosen: locale }),
      init: () => set({ locale: get().chosen ?? DEFAULT_LOCALE })
    }),
    {
      name: 'bookquest.locale',
      // Only the explicit choice is stored; without one, every launch starts in the default.
      partialize: (state) => ({ chosen: state.chosen }),
      merge: (persisted, current) => {
        const chosen = (persisted as { chosen?: unknown } | undefined)?.chosen;
        return { ...current, chosen: isLocale(chosen) ? chosen : null };
      }
    }
  )
);
