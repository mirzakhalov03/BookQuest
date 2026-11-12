import { toRomanNumeral } from '@/lib/format';
import { useT } from '@/i18n';

interface EditionMarkProps {
  /** `quest.edition` — backend-owned, so both halves of the line derive from it, never a literal (spec §11). */
  edition: number;
}

/** "IV · Fourth annual reading competition" (spec §4). Styling in `styles/register.css`. */
export function EditionMark({ edition }: EditionMarkProps) {
  const t = useT();
  return (
    <p className="edition">
      <span className="edition__mark">{toRomanNumeral(edition)}</span>
      <span>{t.registration.editionLine(edition)}</span>
    </p>
  );
}
