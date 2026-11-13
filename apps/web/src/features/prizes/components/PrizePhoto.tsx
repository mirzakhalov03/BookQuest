import { useT } from '@/i18n';

/** The admin's photo of all the prizes, with the edition label resting on its bottom edge. */
export function PrizePhoto({ src, label }: { src: string; label: string }) {
  const t = useT().prizes;
  return (
    <figure className="prize-photo">
      <img src={src} alt={t.photoAlt} className="prize-photo__img" decoding="async" />
      <figcaption className="prize-photo__label type-label">{label}</figcaption>
    </figure>
  );
}
