import { BOOK_RESOURCE_KINDS } from '@bookquest/shared';
import type { BookResourceKind } from '@bookquest/shared';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { emptyResource, isValidResourceUrl, type ResourceDraft } from '../questForm';

const RESOURCE_LIMIT = 12;

interface ResourceListEditorProps {
  resources: ResourceDraft[];
  onChange: (resources: ResourceDraft[]) => void;
  errors: Record<string, string>;
}

/**
 * Add and remove rows, each one `{ label, url, kind }`, max 12. The fiddliest
 * part of this form per the brief, and the reason it's a component of its
 * own rather than inlined in `BookFieldsSection`: three inputs and a remove
 * button, repeated, is its own unit of change.
 *
 * URL validity is checked here for instant feedback — `new URL()` in a
 * try/catch, same spirit as the shared validators the registration form
 * uses, just not one of them (there's no shared "is this a URL" rule to
 * mirror; the server's is `z.string().url()`, which this matches closely
 * enough to catch a typo before a submit does).
 */
export function ResourceListEditor({ resources, onChange, errors }: ResourceListEditorProps) {
  function updateRow(index: number, patch: Partial<ResourceDraft>) {
    onChange(resources.map((resource, i) => (i === index ? { ...resource, ...patch } : resource)));
  }

  function removeRow(index: number) {
    onChange(resources.filter((_, i) => i !== index));
  }

  function addRow() {
    if (resources.length >= RESOURCE_LIMIT) return;
    onChange([...resources, emptyResource()]);
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <p className="type-label">Resources</p>
        <span className="text-xs text-taupe-dim">
          {resources.length}/{RESOURCE_LIMIT}
        </span>
      </div>

      {resources.length === 0 && (
        <p className="text-sm text-taupe">No reading resources yet — add a PDF, an audiobook, a link.</p>
      )}

      <ul className="flex flex-col gap-4">
        {resources.map((resource, index) => {
          const labelError = errors[`book.resources.${index}.label`];
          const serverUrlError = errors[`book.resources.${index}.url`];
          const urlLooksBad = resource.url.trim() !== '' && !isValidResourceUrl(resource.url);

          return (
            <li
              key={index}
              className="grid grid-cols-1 items-end gap-3 border-b border-[color:var(--rule)] pb-4 sm:grid-cols-[1fr_2fr_auto_auto]"
            >
              <Field
                label="Label"
                placeholder="PDF (English)"
                value={resource.label}
                status={labelError ? 'bad' : undefined}
                message={labelError}
                onChange={(event) => updateRow(index, { label: event.target.value })}
              />

              <Field
                label="URL"
                type="url"
                placeholder="https://…"
                value={resource.url}
                status={serverUrlError || urlLooksBad ? 'bad' : undefined}
                message={serverUrlError ?? (urlLooksBad ? 'That doesn’t look like a full URL.' : undefined)}
                onChange={(event) => updateRow(index, { url: event.target.value })}
              />

              <label className="grid gap-[0.4rem]">
                <span className="type-label">Kind</span>
                <select
                  value={resource.kind}
                  onChange={(event) => updateRow(index, { kind: event.target.value as BookResourceKind })}
                  className="h-[3.25rem] border-0 border-b border-b-[color:var(--rule-strong)] bg-transparent px-1 text-base text-paper focus:border-b-[color:var(--color-ember)] focus:outline-none"
                >
                  {BOOK_RESOURCE_KINDS.map((kind) => (
                    <option key={kind} value={kind} className="bg-ink text-paper">
                      {kind}
                    </option>
                  ))}
                </select>
              </label>

              <Button
                type="button"
                variant="quiet"
                onClick={() => removeRow(index)}
                className="min-h-11 self-end justify-self-start px-2"
              >
                Remove
              </Button>
            </li>
          );
        })}
      </ul>

      <Button
        type="button"
        variant="quiet"
        onClick={addRow}
        disabled={resources.length >= RESOURCE_LIMIT}
        className="self-start px-2"
      >
        Add resource
      </Button>
    </section>
  );
}
