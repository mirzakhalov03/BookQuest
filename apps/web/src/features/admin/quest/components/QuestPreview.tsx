import { useState, type ReactNode } from 'react';
import { Eye } from 'lucide-react';
import { BookHero } from '@/components/BookHero';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { parseLocal } from '../../dates';
import { hostnameOf } from '../resources';
import type { QuestFormState } from '../questForm';

const PLACES = [
  ['1st', 'first'],
  ['2nd', 'second'],
  ['3rd', 'third']
] as const;

/** The participant-facing `BookHero`, fed unsaved values — the preview can't drift from the real screen. */
export function QuestPreview({ edition, values }: { edition: number; values: QuestFormState }) {
  const { book, prizes } = values;
  const pages = Number(book.pages);
  const year = parseLocal(values.dates.opensAt)?.getFullYear() ?? new Date().getFullYear();
  const prizeRows = PLACES.map(([place, key]) => [place, prizes[key].trim()] as const).filter(([, prize]) => prize);

  return (
    <div className="flex flex-col gap-5 rounded-box border border-[color:var(--rule)] p-4">
      <p className="type-label m-0">What participants see</p>
      <BookHero
        titleAs="h2"
        edition={edition}
        year={year}
        title={book.title.trim() || 'Untitled'}
        author={book.author.trim() || 'Unknown author'}
        pages={Number.isFinite(pages) && pages > 0 ? pages : 0}
        coverUrl={book.coverUrl || null}
      />
      {book.description.trim() && <p className="m-0 whitespace-pre-line text-paper-dim">{book.description.trim()}</p>}
      {book.resources.length > 0 && (
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {book.resources.map((resource, index) => (
            <li key={index} className="rounded-chip border border-[color:var(--rule)] px-2 py-1 text-sm text-paper-dim">
              {resource.label.trim() || hostnameOf(resource.url)}
            </li>
          ))}
        </ul>
      )}
      {prizeRows.length > 0 && (
        <ol className="m-0 flex list-none flex-col gap-1 p-0 text-sm">
          {prizeRows.map(([place, prize]) => (
            <li key={place} className="text-paper-dim">
              <span className="type-label mr-2">{place}</span>
              {prize}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Form on the left, sticky preview on the right from `lg`; below that the preview lives in a sheet. */
export function QuestEditorLayout({ preview, children }: { preview: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-8 lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-10">
      <div className="min-w-0">{children}</div>
      <aside className="hidden lg:sticky lg:top-6 lg:block">{preview}</aside>
    </div>
  );
}

export function PreviewButton({ preview }: { preview: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button type="button" variant="quiet" onClick={() => setOpen(true)} className="min-h-11 px-3 lg:hidden">
        <Eye aria-hidden className="h-4 w-4" />
        Preview
      </Button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Preview"
        actions={
          <Button type="button" variant="quiet" onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        {preview}
      </Sheet>
    </>
  );
}
