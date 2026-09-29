import { useEffect, useId, useRef, useState, type ChangeEvent } from 'react';
import { ImagePlus } from 'lucide-react';
import { COVER_CONTENT_TYPES, COVER_MAX_BYTES, COVER_MESSAGES } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { ApiRequestError } from '@/lib/api/client';
import { useUploadCover } from '../../api/useUploadCover';

interface CoverPickerProps {
  /** The form's `book.coverUrl`; `''` means the drawn cover. */
  value: string;
  onChange: (url: string) => void;
  /** Server `error.fields['book.coverUrl']` from the quest save. */
  error?: string;
  /** Must be stable (a state setter) — it runs in an effect. */
  onUploadingChange: (uploading: boolean) => void;
}

const HINT = 'JPEG, PNG or WebP · up to 5MB · leave empty for the drawn cover';

// Same rules the API enforces, checked first so a 12MB photo fails instantly instead of after the upload.
function checkFile(file: File): string | null {
  if (!(COVER_CONTENT_TYPES as readonly string[]).includes(file.type)) return COVER_MESSAGES.wrongType;
  if (file.size > COVER_MAX_BYTES) return COVER_MESSAGES.tooLarge;
  return null;
}

/** Uploads on pick; the quest save then sends the returned URL like any other field. */
export function CoverPicker({ value, onChange, error, onUploadingChange }: CoverPickerProps) {
  const inputId = useId();
  const msgId = `${inputId}-msg`;
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCover();
  const [preview, setPreview] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

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
    setLocalError(problem);
    if (problem) return;

    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: ({ url }) => onChange(url),
      onError: (err) =>
        setLocalError(
          err instanceof ApiRequestError ? (err.fields.file ?? err.message) : 'Upload failed. Try again.'
        ),
      onSettled: () => setPreview(null)
    });
  }

  function handleRemove() {
    setLocalError(null);
    onChange('');
  }

  const shown = preview ?? (value || null);
  const message = localError ?? error ?? HINT;
  const isBad = Boolean(localError ?? error);

  return (
    <div className="grid gap-[0.4rem]">
      <span className="type-label">Cover</span>

      <div className="flex items-end gap-5">
        <label
          htmlFor={inputId}
          className="relative grid aspect-[2/3] w-32 cursor-pointer place-items-center overflow-hidden rounded-box border border-dashed border-[color:var(--rule-strong)] text-taupe transition-colors duration-150 hover:border-[color:var(--color-ember)] hover:text-paper-dim focus-within:border-[color:var(--color-ember)]"
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
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept={COVER_CONTENT_TYPES.join(',')}
            disabled={upload.isPending}
            aria-describedby={msgId}
            onChange={handleChange}
            className="sr-only"
          />
        </label>

        {value && !upload.isPending && (
          <div className="flex flex-col">
            <Button type="button" variant="quiet" onClick={() => inputRef.current?.click()}>
              Replace
            </Button>
            <Button type="button" variant="quiet" onClick={handleRemove}>
              Remove
            </Button>
          </div>
        )}
      </div>

      <p
        id={msgId}
        role="status"
        className={`m-0 min-h-[1.15rem] text-sm leading-[1.35] ${isBad ? 'text-error' : 'text-taupe'}`}
      >
        {message}
      </p>
    </div>
  );
}
