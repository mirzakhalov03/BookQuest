import type { ChangeEvent } from 'react';
import { Field } from '@/components/ui/Field';
import type { QuestFormState } from '../questForm';
import { CoverPicker } from './CoverPicker';

interface BookFieldsSectionProps {
  value: QuestFormState['book'];
  onChange: (value: QuestFormState['book']) => void;
  /** Server `error.fields`, dotted paths — `book.title`, `book.pages`, etc.
   * The whole map is handed to every section rather than sliced per-section:
   * each one only ever reads the few keys it owns. */
  errors: Record<string, string>;
  /** Lets the editor hold Save while a cover is still uploading. */
  onCoverUploadingChange: (uploading: boolean) => void;
}

/**
 * Title, author, pages, cover and description. The cover uploads on pick and
 * lands here as a URL, so the save path treats it like any other text field.
 */
export function BookFieldsSection({ value, onChange, errors, onCoverUploadingChange }: BookFieldsSectionProps) {
  const set = (patch: Partial<QuestFormState['book']>) => onChange({ ...value, ...patch });

  return (
    <section className="flex flex-col gap-4">
      <p className="type-label">Book</p>

      <Field
        label="Title"
        value={value.title}
        status={errors['book.title'] ? 'bad' : undefined}
        message={errors['book.title']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => set({ title: event.target.value })}
      />

      <Field
        label="Author"
        value={value.author}
        status={errors['book.author'] ? 'bad' : undefined}
        message={errors['book.author']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => set({ author: event.target.value })}
      />

      <Field
        label="Pages"
        type="number"
        min={1}
        value={value.pages}
        status={errors['book.pages'] ? 'bad' : undefined}
        message={errors['book.pages']}
        onChange={(event: ChangeEvent<HTMLInputElement>) => set({ pages: event.target.value })}
      />

      <CoverPicker
        value={value.coverUrl}
        error={errors['book.coverUrl']}
        onChange={(coverUrl) => set({ coverUrl })}
        onUploadingChange={onCoverUploadingChange}
      />

      <label className="grid gap-[0.4rem]">
        <span className="type-label">Description</span>
        <textarea
          value={value.description}
          rows={4}
          placeholder="A shepherd boy leaves everything he knows…"
          onChange={(event) => set({ description: event.target.value })}
          className="w-full resize-y border-0 border-b border-b-[color:var(--rule-strong)] bg-transparent px-[0.15rem] py-2 text-base text-paper placeholder:text-taupe focus:border-b-[color:var(--color-ember)] focus:outline-none"
        />
        <p className="min-h-[1.15rem] text-sm text-[#E9976A]">{errors['book.description']}</p>
      </label>
    </section>
  );
}
