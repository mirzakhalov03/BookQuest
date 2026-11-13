import { useState, type CSSProperties } from 'react';
import { Pencil } from 'lucide-react';
import type { AvatarId } from '@bookquest/shared';
import { ParticipantNumeral } from '@/components/ui/ParticipantNumeral';
import { Avatar } from './Avatar';
import { AvatarPicker } from './AvatarPicker';
import { useMascotGreeting } from '../useMascotGreeting';
import { useT } from '@/i18n';

interface ReaderPassProps {
  /** Keys the first-time mascot greeting, so each account on a device gets its own. */
  userId?: string;
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
  userId,
  name,
  avatar,
  number,
  telegramUsername,
  phoneNumber
}: ReaderPassProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const t = useT().profile;
  const contacts = [telegramUsername && `@${telegramUsername}`, phoneNumber].filter(Boolean);
  const hasStub = number !== undefined;
  const greeting = useMascotGreeting(userId, avatar !== null);

  function openPicker() {
    greeting.dismissTip();
    setPickerOpen(true);
  }

  return (
    <>
      <div className="relative">
        <header className="pass">
          <div className={hasStub ? 'pass__stub pass__stub--top' : 'pass__stub rounded-box'}>
            <div className="flex items-center gap-5">
              <button
                type="button"
                onClick={openPicker}
                aria-label={t.changeAvatar}
                data-greet={greeting.variant}
                className="mascot group relative shrink-0 rounded-full transition-transform duration-150 active:scale-95"
              >
                {greeting.variant === 'hello' && <Sparkles />}
                <Avatar
                  name={name}
                  avatar={avatar}
                  className="mascot__img w-[clamp(5.5rem,28vw,8.5rem)]"
                />
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
                <span className="type-label">{t.participantNumber}</span>
                <ParticipantNumeral value={number} className="pass__number" />
              </div>
              <span className="mb-1 max-w-[9rem] text-right text-xs leading-snug text-taupe-dim">
                {t.numberHint}
              </span>
            </div>
          )}
        </header>

        {/* Outside the pass: the top stub's notch mask would clip it. */}
        {greeting.showTip && (
          <button type="button" className="mascot-tip" onClick={openPicker}>
            {t.meetMascot}
          </button>
        )}
      </div>

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

/** The first hello's burst: six motes flung out from behind the mascot. */
function Sparkles() {
  return (
    <span className="mascot__sparkles" aria-hidden="true">
      {[0, 1, 2, 3, 4, 5].map((index) => (
        <span key={index} style={{ '--i': index } as CSSProperties} />
      ))}
    </span>
  );
}
