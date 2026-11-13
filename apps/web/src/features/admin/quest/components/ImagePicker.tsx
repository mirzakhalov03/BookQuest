import { useEffect, useId, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { Eye, ImagePlus, RefreshCw, Trash2, type LucideIcon } from 'lucide-react';
import { COVER_CONTENT_TYPES, COVER_MAX_BYTES } from '@bookquest/shared';
import { Button } from '@/components/ui/Button';
import { Sheet } from '@/components/ui/Sheet';
import { Spinner } from '@/components/ui/Spinner';
import { ApiRequestError } from '@/lib/api/client';
import { downscaleImage } from '@/lib/downscaleImage';
import { useUiStore } from '@/stores/ui.store';
import { useUploadCover } from '../../api/useUploadCover';
import { useT } from '@/i18n';
import { errorMessage, fieldErrorMessage } from '@/lib/api/errorMessage';

export interface ImagePickerLabels {
  title: string;
  alt: string;
  choose: string;
  replace: string;
  view: string;
  remove: string;
}

const SHAPES = {
  // A book cover, beside a short field.
  cover: { wrap: 'shrink-0', box: 'aspect-[2/3] w-32', maxSide: 1000 },
  // A full-width photo, e.g. all the prizes together.
  wide: { wrap: 'flex-1', box: 'aspect-[4/3] w-full max-w-md', maxSide: 1600 }
} as const;

interface ImagePickerProps {
  /** The form's URL field; `''` means no image. */
  value: string;
  onChange: (url: string) => void;
  labels: ImagePickerLabels;
  shape?: keyof typeof SHAPES;
  /** Server field error for this URL from the quest save. */
  error?: string;
  /** Must be stable (a state setter) — it runs in an effect. */
  onUploadingChange: (uploading: boolean) => void;
  /** Sits beside the image, top-aligned — for a short field that doesn't need its own row. */
  aside?: ReactNode;
}

const isCoverType = (file: File): boolean => (COVER_CONTENT_TYPES as readonly string[]).includes(file.type);

/** Uploads on pick (through the cover pipeline); the quest save then sends the returned URL like any other field. */
export function ImagePicker({
  value,
  onChange,
  labels,
  shape = 'cover',
  error,
  onUploadingChange,
  aside
}: ImagePickerProps) {
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const upload = useUploadCover();
  const [preview, setPreview] = useState<string | null>(null);
  const showToast = useUiStore((state) => state.showToast);
  const { common, errors, adminQuest } = useT();
  const { wrap, box, maxSide } = SHAPES[shape];
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

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const picked = event.target.files?.[0];
    event.target.value = ''; // so picking the same file again still fires change
    if (!picked) return;
    if (!isCoverType(picked)) {
      showToast(errors.reasons.cover_wrong_type);
      return;
    }

    // Size is checked after shrinking, so a big phone photo is fine; the API enforces the same cap.
    const file = await downscaleImage(picked, maxSide);
    if (file.size > COVER_MAX_BYTES) {
      showToast(errors.reasons.cover_too_large);
      return;
    }

    setPreview(URL.createObjectURL(file));
    upload.mutate(file, {
      onSuccess: ({ url }) => onChange(url),
      onError: (err) =>
        showToast(
          err instanceof ApiRequestError
            ? (fieldErrorMessage(err, 'file') ?? errorMessage(err))
            : adminQuest.book.uploadFailed
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
        <div className={`grid ${wrap} gap-[0.4rem]`}>
          <span className="type-label">{labels.title}</span>
          <label
            htmlFor={inputId}
            className={`group relative grid ${box} place-items-center overflow-hidden rounded-box border border-dashed border-[color:var(--rule-strong)] text-taupe transition-colors duration-150 focus-within:border-[color:var(--color-ember)] cursor-pointer hover:border-[color:var(--color-ember)] hover:text-paper-dim`}
          >
            {shown ? (
              <img
                src={shown}
                alt={labels.alt}
                className={`h-full w-full object-cover transition-opacity ${upload.isPending ? 'opacity-50' : ''}`}
              />
            ) : (
              <span className="flex flex-col items-center gap-2 px-3 text-center text-sm">
                <ImagePlus aria-hidden className="h-6 w-6" />
                {labels.choose}
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
                  label={labels.replace}
                  icon={RefreshCw}
                  onClick={() => inputRef.current?.click()}
                />
                <OverlayButton label={labels.view} icon={Eye} onClick={() => setIsViewing(true)} />
                <OverlayButton label={labels.remove} icon={Trash2} onClick={handleRemove} />
              </span>
            )}
            <input
              ref={inputRef}
              id={inputId}
              type="file"
              accept={COVER_CONTENT_TYPES.join(',')}
              disabled={upload.isPending}
              onChange={(event) => void handleChange(event)}
              className="sr-only"
            />
          </label>
        </div>
        {aside && <div className="min-w-0 flex-1">{aside}</div>}
      </div>

      <Sheet
        open={isViewing}
        onClose={() => setIsViewing(false)}
        title={labels.title}
        actions={
          <Button type="button" variant="quiet" onClick={() => setIsViewing(false)}>
            {common.close}
          </Button>
        }
      >
        {value && (
          <img
            src={value}
            alt={labels.alt}
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
