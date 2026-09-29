import { useState } from 'react';
import { Controller, useFieldArray, useFormContext, useWatch } from 'react-hook-form';
import type { BookResourceKind } from '@bookquest/shared';
import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, ArrowDown, ArrowUp, BookOpen, FileText, Headphones, Link2 } from 'lucide-react';
import { Field, statusFor } from '@/components/ui/Field';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { isValidResourceUrl, type QuestFormState } from '../questForm';
import { KIND_OPTIONS, RESOURCE_LIMIT, defaultLabel, hostnameOf, inferKind } from '../resources';

const KIND_ICON: Record<BookResourceKind, LucideIcon> = {
  pdf: FileText,
  epub: BookOpen,
  audio: Headphones,
  link: Link2
};

/**
 * Paste a link and the row fills itself in; rows stay collapsed to one line
 * until tapped, so twelve links is still a short list on a phone.
 */
export function ResourceListEditor() {
  const {
    control,
    register,
    formState: { errors }
  } = useFormContext<QuestFormState>();
  const { fields, append, remove, move } = useFieldArray({ control, name: 'book.resources' });
  const resources = useWatch({ control, name: 'book.resources' });
  const [openId, setOpenId] = useState<string | null>(null);
  const [draftUrl, setDraftUrl] = useState('');
  const [draftError, setDraftError] = useState<string | undefined>();
  const isFull = fields.length >= RESOURCE_LIMIT;

  function add(raw: string) {
    const url = raw.trim();
    if (!url) return;
    if (!isValidResourceUrl(url)) {
      setDraftError('Paste a full link, starting with https://');
      return;
    }
    const kind = inferKind(url);
    append({ url, kind, label: defaultLabel(kind, url) });
    setDraftUrl('');
    setDraftError(undefined);
  }

  return (
    <>
      {fields.length === 0 ? (
        <p className="m-0 text-sm text-taupe">No reading resources yet. Paste a link to a PDF, an audiobook or a shop.</p>
      ) : (
        <ul className="m-0 flex list-none flex-col divide-y divide-[color:var(--rule)] p-0">
          {fields.map((field, index) => {
            const current = resources[index] ?? field;
            const rowErrors = errors.book?.resources?.[index];
            const isOpen = openId === field.id || Boolean(rowErrors);
            const Icon = KIND_ICON[current.kind];

            return (
              <li key={field.id} className="py-1">
                <button
                  type="button"
                  aria-expanded={isOpen}
                  onClick={() => setOpenId(isOpen ? null : field.id)}
                  className="flex min-h-11 w-full items-center gap-3 text-left"
                >
                  <Icon aria-hidden className="h-4 w-4 shrink-0 text-taupe" />
                  <span className="min-w-0 flex-1 truncate text-paper">{current.label || 'Untitled'}</span>
                  <span className="max-w-[40%] truncate text-sm text-taupe-dim">{hostnameOf(current.url)}</span>
                  {rowErrors && <AlertTriangle aria-label="Has errors" className="h-4 w-4 shrink-0 text-error" />}
                </button>

                <div hidden={!isOpen} className="grid gap-3 pb-3 pt-1 sm:grid-cols-[1fr_2fr_8rem]">
                  <Field label="Label" {...register(`book.resources.${index}.label`)} {...statusFor(rowErrors?.label?.message)} />
                  <Field
                    label="URL"
                    type="url"
                    inputMode="url"
                    {...register(`book.resources.${index}.url`)}
                    {...statusFor(rowErrors?.url?.message)}
                  />
                  <Controller
                    control={control}
                    name={`book.resources.${index}.kind`}
                    render={({ field: kind }) => (
                      <Select label="Kind" options={KIND_OPTIONS} value={kind.value} onChange={kind.onChange} />
                    )}
                  />
                  <div className="flex items-center gap-1 sm:col-span-3">
                    <Button type="button" variant="quiet" aria-label="Move up" disabled={index === 0} onClick={() => move(index, index - 1)} className="min-h-11 px-2">
                      <ArrowUp aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      variant="quiet"
                      aria-label="Move down"
                      disabled={index === fields.length - 1}
                      onClick={() => move(index, index + 1)}
                      className="min-h-11 px-2"
                    >
                      <ArrowDown aria-hidden className="h-4 w-4" />
                    </Button>
                    <Button type="button" variant="quiet" onClick={() => remove(index)} className="ml-auto min-h-11 px-2">
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex items-end gap-2">
        <Field
          className="flex-1"
          label={isFull ? `That's the limit of ${RESOURCE_LIMIT}` : `Add a link · ${fields.length}/${RESOURCE_LIMIT}`}
          type="url"
          inputMode="url"
          placeholder="https://…"
          value={draftUrl}
          disabled={isFull}
          onChange={(event) => {
            setDraftUrl(event.target.value);
            setDraftError(undefined);
          }}
          // A pasted full URL is added straight away; anything else waits for Add or Enter.
          onPaste={(event) => {
            const text = event.clipboardData.getData('text').trim();
            if (!isValidResourceUrl(text)) return;
            event.preventDefault();
            add(text);
          }}
          onKeyDown={(event) => {
            if (event.key !== 'Enter') return;
            event.preventDefault(); // Enter would otherwise submit the whole quest form.
            add(draftUrl);
          }}
          {...statusFor(draftError)}
        />
        <Button
          type="button"
          variant="quiet"
          disabled={isFull || !draftUrl.trim()}
          onClick={() => add(draftUrl)}
          className="mb-[1.55rem] min-h-11 px-3"
        >
          Add
        </Button>
      </div>
    </>
  );
}
