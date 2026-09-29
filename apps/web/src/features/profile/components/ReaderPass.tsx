import { useState } from 'react';
import { Pencil } from 'lucide-react';
import type { AvatarId } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { Avatar } from './Avatar';
import { AvatarPicker } from './AvatarPicker';

interface ReaderPassProps {
  name: string;
  avatar: AvatarId | null;
  /** Absent when signed in but not in this edition — the pass then has no tear-off stub. */
  number?: number;
  telegramUsername?: string | null;
  phoneNumber?: string | null;
}

/**
 * The top of `/me`, drawn as a ticket: who you are above the tear line, your
 * participant number below it — the one thing the product asks you to keep.
 */
export function ReaderPass({
  name,
  avatar,
  number,
  telegramUsername,
  phoneNumber
}: ReaderPassProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const contacts = [telegramUsername && `@${telegramUsername}`, phoneNumber].filter(Boolean);
  const hasStub = number !== undefined;

  return (
    <>
      <header className="pass">
        <div className={hasStub ? 'pass__stub pass__stub--top' : 'pass__stub rounded-box'}>
          <div className="flex items-center gap-5">
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              aria-label="Change avatar"
              className="group relative shrink-0 rounded-full transition-transform duration-150 active:scale-95"
            >
              <Avatar name={name} avatar={avatar} className="w-[clamp(5.5rem,28vw,8.5rem)]" />
              <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[color:var(--color-ash)] bg-gold text-ink shadow-md transition-colors group-hover:bg-gold-soft">
                <Pencil className="h-3.5 w-3.5" strokeWidth={2.4} aria-hidden="true" />
              </span>
            </button>
            <div className="flex min-w-0 flex-1 flex-col gap-2 text-right">
              <h1 className="type-display m-0 break-words text-[clamp(1.35rem,6.5vw,1.85rem)] leading-[1.05] text-paper">
                {name}
              </h1>
              {contacts.map((contact) => (
                <p key={contact as string} className="m-0 truncate text-sm text-taupe">
                  {contact}
                </p>
              ))}
            </div>
          </div>
        </div>

        {hasStub && (
          <div className="pass__stub pass__stub--bottom flex items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="type-label">Participant number</span>
              <ParticipantNumeral value={number} className="pass__number" />
            </div>
            <span className="mb-1 max-w-[9rem] text-right text-xs leading-snug text-taupe-dim">
              On the leaderboard and your certificate
            </span>
          </div>
        )}
      </header>

      {/* Outside the pass: its mask and filter shouldn't be ancestors of the sheet. */}
      <AvatarPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        name={name}
        current={avatar}
      />
    </>
  );
}
