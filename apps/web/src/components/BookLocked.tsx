import type { CSSProperties } from 'react';
import { SealedTome } from './SealedTome';
import { useT } from '@/i18n';

// Larger than `/book`'s hero, since the book is the whole screen here. `--book-h` follows from it.
const TOME_SIZE = { '--book-w': '10.5rem' } as CSSProperties;

/** The book page while the admin keeps it a secret (`/book`, or the current edition's `/quests/:n`): no title, no links. */
export function BookLocked({ titleAs: Title = 'h1' }: { titleAs?: 'h1' | 'h2' }) {
  const t = useT().book;
  // `overflow-x-clip`: the rays and sparks reach past the screen edge, which must not scroll sideways.
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-7 overflow-x-clip py-8 text-center">
      {/* Room above for the rays and sparks; the tome draws outside its own box. */}
      <div className="pt-6 pb-2" style={TOME_SIZE}>
        <SealedTome />
      </div>
      <div className="flex max-w-[22rem] flex-col gap-2">
        <Title className="type-display text-2xl text-paper">{t.lockedTitle}</Title>
        <p className="text-taupe">{t.lockedBody}</p>
      </div>
    </section>
  );
}
