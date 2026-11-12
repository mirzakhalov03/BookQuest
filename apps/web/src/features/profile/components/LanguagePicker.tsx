import { Segmented } from '@/components/ui/Segmented';
import { LOCALES, LOCALE_NAMES, useLocale, useT, type Locale } from '@/i18n';
import { haptic } from '@/lib/telegram';
import { useLocaleStore } from '@/stores/locale.store';

// Each name in its own language, so a reader stuck in the wrong one still recognises theirs.
const OPTIONS = LOCALES.map((locale) => ({ value: locale, label: LOCALE_NAMES[locale], lang: locale }));

/** Switches the whole interface at once; the pick is remembered and outranks Telegram's language from then on. */
export function LanguagePicker() {
  const t = useT();
  const locale = useLocale();
  const setLocale = useLocaleStore((state) => state.setLocale);

  // Always stored, even when it matches the detected language: tapping it is still a choice to keep.
  const choose = (next: Locale) => {
    if (next !== locale) haptic('select');
    setLocale(next);
  };

  return (
    <section className="flex flex-col gap-2">
      <p className="type-label m-0">{t.profile.language}</p>
      <Segmented aria-label={t.profile.language} options={OPTIONS} value={locale} onChange={choose} className="w-full" />
    </section>
  );
}
