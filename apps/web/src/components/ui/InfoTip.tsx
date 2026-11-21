import { useEffect, useId, useRef, useState } from 'react';
import { Info } from 'lucide-react';
import { haptic } from '@/lib/telegram';

interface InfoTipProps {
  /** Names the button for screen readers, e.g. "Why we ask for this". */
  label: string;
  children: string;
}

/** A tap-to-open "why?" bubble. Tap, not hover: most readers are on a phone inside Telegram. */
export function InfoTip({ label, children }: InfoTipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLSpanElement>(null);
  const tipId = useId();

  useEffect(() => {
    if (!open) return;
    const closeOutside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  return (
    <span ref={rootRef} className="relative inline-flex align-middle">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={tipId}
        onClick={() => {
          haptic('select');
          setOpen((value) => !value);
        }}
        // 28px hit area around a 15px glyph, so it's tappable without looking loud.
        className={`-m-1.5 flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
          open ? 'text-gold-soft' : 'text-taupe hover:text-paper-dim'
        }`}
      >
        <Info className="h-[15px] w-[15px]" strokeWidth={2} aria-hidden="true" />
      </button>
      {open && (
        <span id={tipId} role="tooltip" className="info-tip">
          {children}
        </span>
      )}
    </span>
  );
}
