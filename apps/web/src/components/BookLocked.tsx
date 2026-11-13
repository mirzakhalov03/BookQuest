import type { CSSProperties } from 'react';
import { MysteryCover } from './MysteryCover';
import { useT } from '@/i18n';

// 1.47 is the cover's aspect ratio; larger than `/book`'s hero, since the cover is the whole screen here.
const COVER_STYLE = { '--book-w': '10rem', height: `${10 * 1.47}rem` } as CSSProperties;

/** The book page while the admin keeps it a secret (`/book`, or the current edition's `/quests/:n`): no title, no links. */
export function BookLocked() {
  const t = useT().book;
  return (
    <section className="flex flex-1 flex-col items-center justify-center gap-6 py-8 text-center">
      <div className="cover-box" style={COVER_STYLE}>
        <MysteryCover />
      </div>
      <div className="flex max-w-[22rem] flex-col gap-2">
        <h1 className="type-display text-2xl text-paper">{t.lockedTitle}</h1>
        <p className="text-taupe">{t.lockedBody}</p>
      </div>
    </section>
  );
}
