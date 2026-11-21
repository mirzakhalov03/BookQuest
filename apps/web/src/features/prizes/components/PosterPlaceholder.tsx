import { Trophy } from 'lucide-react';
import { useT } from '@/i18n';

/** This year's poster before it's uploaded. */
export function PosterPlaceholder({ label }: { label: string }) {
  const t = useT().prizes;
  return (
    <figure className="poster-soon m-0" aria-label={t.posterSoon}>
      <span className="poster-soon__icon">
        <Trophy className="h-8 w-8" strokeWidth={1.5} aria-hidden="true" />
      </span>
      <figcaption className="flex flex-col gap-1 px-6">
        <span className="type-label">{label}</span>
        <span className="type-display text-xl text-paper">{t.posterSoon}</span>
      </figcaption>
    </figure>
  );
}
