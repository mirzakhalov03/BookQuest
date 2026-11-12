const RU = new Intl.PluralRules('ru');

/** "1 question", "3 questions". */
export const pluralEn = (n: number, one: string, other: string): string => (n === 1 ? one : other);

/** Russian's three forms: 1 вопрос, 3 вопроса, 5 вопросов (21 → one, 22 → few, 11–14 → many). */
export function pluralRu(n: number, one: string, few: string, many: string): string {
  const rule = RU.select(n);
  return rule === 'one' ? one : rule === 'few' ? few : many;
}
