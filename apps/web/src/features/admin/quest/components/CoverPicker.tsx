import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Eye, ImagePlus, RefreshCw, Trash2, type LucideIcon } from 'lucide-react';
import { COVER_CONTENT_TYPES, COVER_MAX_BYTES, COVER_MESSAGES } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { ApiRequestError } from '@/lib/api/client';
import { useUiStore } from '@/stores/ui.store';
import { useUploadCover } from '../../api/useUploadCover';

interface CoverPickerProps {
  /** The form's `book.coverUrl`; `''` means the drawn cover. */
  value: string;
  onChange: (url: string) => void;
  /** Server `error.fields['book.coverUrl']` from the quest save. */
  error?: string;
  /** Must be stable (a state setter) — it runs in an effect. */
  onUploadingChange: (uploading: boolean) => void;
  /** Sits beside the image, top-aligned — for a short field that doesn't need its own row. */
  aside?: ReactNode;
}

// Same rules the API enforces, checked first so a 12MB photo fails instantly instead of after the upload.
function checkFile(file: File): string | null {
  if (!(COVER_CONTENT_TYPES as readonly string[]).includes(file.type))
    return COVER_MESSAGES.wrongType;
  if (file.size > COVER_MAX_BYTES) return COVER_MESSAGES.tooLarge;
  return null;
}

/** Uploads on pick; the quest save then sends the returned URL like any other field. */
export function CoverPicker({
  value,
  onChange,
  error,
  onUploadingChange,
  aside
}: CoverPickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCover();
  const [preview, setPreview] = useState<string | null>(null);
  const showToast = useUiStore((state) => state.showToast);
  const [isViewing, setIsViewing] = useState(false);

  // The server's verdict on the saved cover arrives as a field error; surface it like the rest.
  useEffect(() => {
    if (error) showToast(error);
  }, [error, showToast]);
  useEffect(() => onUploadingChange(upload.isPending), [upload.isPending, onUploadingChange]);
  useEffect(
    () => () => {
      if (preview) URL.revokeObjectURL(preview);
    },
    [preview]
  );

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still fires change
    if (!file) return;

    const problem = checkFile(file);
    if (problem) {
      showToast(problem);
      return;
    }

    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: ({ url }) => onChange(url),
      onError: (err) =>
        showToast(
          err instanceof ApiRequestError
            ? (err.fields.file ?? err.message)
            : 'Upload failed. Try again.'
        ),
      onSettled: () => setPreview(null)
    });
  }

  function handleRemove() {
    onChange('');
  }

  const shown = preview ?? (value || null);

  return (
    <div className="grid gap-[0.4rem]">
      <div className="flex items-start gap-5">
        <div className="grid shrink-0 gap-[0.4rem]">
          <span className="type-label">Cover</span>
          <label
            htmlFor={inputId}
            className={`group relative grid aspect-[2/3] w-32 place-items-center overflow-hidden rounded-box border border-dashed border-[color:var(--rule-strong)] text-taupe transition-colors duration-150 focus-within:border-[color:var(--color-ember)] cursor-pointer hover:border-[color:var(--color-ember)] hover:text-paper-dim`}
          >
            {shown ? (
              <img
                src={shown}
                alt="Book cover"
                className={`h-full w-full object-cover transition-opacity ${upload.isPending ? 'opacity-50' : ''}`}
              />
            ) : (
              <span className="flex flex-col items-center gap-2 px-3 text-center text-sm">
                <ImagePlus aria-hidden className="h-6 w-6" />
                Choose a cover image
              </span>
            )}
            {upload.isPending && (
              <span className="absolute inset-0 grid place-items-center">
                <Spinner size="md" />
              </span>
            )}
            {value && !upload.isPending && (
              <span className="absolute inset-x-0 bottom-0 flex justify-center gap-2 bg-gradient-to-t from-black/75 to-transparent px-2 pb-2 pt-6">
                <OverlayButton
                  label="Replace cover"
                  icon={RefreshCw}
                  onClick={() => inputRef.current?.click()}
                />
                <OverlayButton label="View cover" icon={Eye} onClick={() => setIsViewing(true)} />
                <OverlayButton label="Remove cover" icon={Trash2} onClick={handleRemove} />
              </span>
            )}
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={COVER_CONTENT_TYPES.join(',')}
              disabled={upload.isPending}
              onChange={handleChange}
              className="sr-only"
            />
          </label>
        </div>
        {aside && <div className="min-w-0 flex-1">{aside}</div>}
      </div>

      <Sheet
        open={isViewing}
        onClose={() => setIsViewing(false)}
        title="Cover"
        actions={
          <Button type="button" variant="quiet" onClick={() => setIsViewing(false)}>
            Close
          </Button>
        }
      >
        {value && (
          <img
            src={value}
            alt="Book cover"
            className="mx-auto max-h-[65vh] w-auto rounded-box object-contain"
          />
        )}
      </Sheet>
    </div>
  );
}

interface OverlayButtonProps {
  label: string;
  icon: LucideIcon;
  onClick: () => void;
}

function OverlayButton({ label, icon: Icon, onClick }: OverlayButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid h-9 w-9 place-items-center rounded-full bg-black/60 text-paper transition-colors hover:bg-black/80 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[color:var(--color-ember)]"
    >
      <Icon aria-hidden className="h-4 w-4" />
    </button>
  );
}
