import { useEffect, useRef, type ReactNode } from 'react';
import { Check, X } from 'lucide-react';
import type { AvatarId } from '@bookquest/shared';
import { haptic } from '@/lib/telegram';
import { AVATAR_OPTIONS, avatarLabel } from '../avatars';
import { useUpdateAvatar } from '../api/useUpdateAvatar';
import { Avatar } from './Avatar';
import { useT } from '@/i18n';

interface AvatarPickerProps {
  open: boolean;
  onClose: () => void;
  name: string;
  current: AvatarId | null;
}

/**
 * A bottom sheet on the native `<dialog>`: focus trapping, Escape and the top
 * layer (above the tab bar) come for free. A tap saves and closes — no confirm step.
 */
export function AvatarPicker({ open, onClose, name, current }: AvatarPickerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const updateAvatar = useUpdateAvatar();
  const t = useT();

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const pick = (avatar: AvatarId | null) => {
    haptic('select');
    if (avatar !== current) updateAvatar.mutate(avatar);
    onClose();
  };

  return (
    <dialog
      ref={dialogRef}
      className="avatar-sheet"
      aria-labelledby="avatar-sheet-title"
      onClose={onClose}
      // A click landing on the dialog itself, not its content, is the backdrop.
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="flex flex-col gap-5 px-5 pb-[calc(1.5rem+var(--safe-b))] pt-3">
        <span
          aria-hidden="true"
          className="mx-auto h-1 w-10 rounded-full bg-[color:var(--rule-strong)]"
        />

        <div className="flex items-center justify-between">
          <h2 id="avatar-sheet-title" className="type-display m-0 text-xl text-paper">
            {t.profile.pickAvatar}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t.common.close}
            className="flex h-9 w-9 items-center justify-center rounded-full text-taupe hover:bg-ash-hi hover:text-paper-dim"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </button>
        </div>

        {/* Its own row so the 12 mascots keep a clean 3×4 grid */}
        <button
          type="button"
          onClick={() => pick(null)}
          aria-pressed={current === null}
          className={`flex items-center gap-3 rounded-box bg-ash-hi px-3 py-2 text-left transition-transform duration-150 active:scale-[0.98] ${
            current === null
              ? 'ring-2 ring-gold'
              : 'ring-1 ring-[color:var(--rule)] hover:ring-[color:var(--rule-strong)]'
          }`}
        >
          <Avatar name={name} className="w-10" />
          <span className="flex-1 text-paper-dim">{t.profile.initials}</span>
          {current === null && <SelectedMark />}
        </button>

        <div className="grid grid-cols-3 gap-3">
          {AVATAR_OPTIONS.map((id) => (
            <AvatarTile
              key={id}
              label={avatarLabel(id)}
              selected={current === id}
              onPick={() => pick(id)}
            >
              <Avatar name={name} avatar={id} className="w-[82%]" />
            </AvatarTile>
          ))}
        </div>
      </div>
    </dialog>
  );
}

function AvatarTile({
  label,
  selected,
  onPick,
  children
}: {
  label: string;
  selected: boolean;
  onPick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      aria-label={label}
      aria-pressed={selected}
      className={`relative flex aspect-square items-center justify-center rounded-box bg-ash-hi transition-transform duration-150 active:scale-95 ${
        selected
          ? 'ring-2 ring-gold'
          : 'ring-1 ring-[color:var(--rule)] hover:ring-[color:var(--rule-strong)]'
      }`}
    >
      {children}
      {selected && <SelectedMark className="absolute right-1.5 top-1.5" />}
    </button>
  );
}

function SelectedMark({ className = '' }: { className?: string }) {
  return (
    <span className={`flex h-5 w-5 items-center justify-center rounded-full bg-gold text-ink ${className}`}>
      <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden="true" />
    </span>
  );
}
