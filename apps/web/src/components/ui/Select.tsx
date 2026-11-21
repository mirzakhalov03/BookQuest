import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import { useAnchoredPosition } from '@/hooks/useAnchoredPosition';
import { useT } from '@/i18n';
import { useFieldSize } from './fieldSize';
import { fieldLineClass, fieldSurfaceClass } from './Field';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
  /** A second, quieter line under the label. */
  hint?: string;
}

interface SelectProps<V extends string> {
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  className?: string;
  disabled?: boolean;
}

/**
 * A listbox in `Field`'s clothes (WAI-ARIA select-only combobox). The list is portalled and
 * fixed-positioned, so scrolling tables can't clip it; any outside scroll closes it.
 */
export function Select<V extends string>({ label, value, options, onChange, className = '', disabled }: SelectProps<V>) {
  const id = useId();
  const compact = useFieldSize() === 'compact';
  const t = useT().common;
  const triggerRef = useRef<HTMLButtonElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const position = useAnchoredPosition(triggerRef, open);
  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = options[selectedIndex];

  function show() {
    if (disabled) return;
    setActive(Math.max(0, selectedIndex));
    setOpen(true);
  }

  function close(refocus = true) {
    setOpen(false);
    if (refocus) triggerRef.current?.focus();
  }

  function pick(index: number) {
    const option = options[index];
    if (option) onChange(option.value);
    close();
  }

  // Outside press and any scroll (except inside the list) close it.
  useEffect(() => {
    if (!open) return;
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!listRef.current?.contains(target) && !triggerRef.current?.contains(target)) close(false);
    };
    const onScroll = (event: Event) => {
      if (!listRef.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [open]);

  // Keep the active option in view while arrowing through a long list.
  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  function onKeyDown(event: KeyboardEvent) {
    const last = options.length - 1;
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    const move = (next: number) => {
      event.preventDefault();
      setActive(Math.min(last, Math.max(0, next)));
    };
    switch (event.key) {
      case 'ArrowDown':
        return move(active + 1);
      case 'ArrowUp':
        return move(active - 1);
      case 'Home':
        return move(0);
      case 'End':
        return move(last);
      case 'Enter':
      case ' ':
        event.preventDefault();
        return pick(active);
      case 'Escape':
        event.preventDefault();
        return close();
      case 'Tab':
        return close(false);
      default:
        // Type-ahead: the next option starting with that letter, cycling.
        if (event.key.length === 1) {
          const letter = event.key.toLowerCase();
          const order = [...options.keys()].map((i) => (active + 1 + i) % options.length);
          const hit = order.find((i) => options[i]?.label.toLowerCase().startsWith(letter));
          if (hit !== undefined) setActive(hit);
        }
    }
  }

  return (
    <div className={`grid gap-[0.4rem] ${className}`}>
      <span id={`${id}-label`} className="type-label">
        {label}
      </span>
      <button
        ref={triggerRef}
        type="button"
        role="combobox"
        aria-labelledby={`${id}-label`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-list`}
        aria-activedescendant={open ? `${id}-opt-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? close() : show())}
        onKeyDown={onKeyDown}
        className={`${compact ? 'h-11' : 'h-[3.25rem]'} flex w-full items-center gap-2 px-3 text-left text-base transition-[border-color,box-shadow] duration-[180ms] focus:outline-none disabled:opacity-50 ${fieldSurfaceClass} ${fieldLineClass()}`}
      >
        <span className={`min-w-0 flex-1 truncate ${selected ? 'text-paper' : 'text-taupe'}`}>
          {selected?.label ?? t.choose}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-taupe transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open &&
        position &&
        createPortal(
          <ul
            ref={listRef}
            id={`${id}-list`}
            role="listbox"
            aria-labelledby={`${id}-label`}
            style={{
              position: 'fixed',
              left: position.left,
              width: position.width,
              maxHeight: position.maxHeight,
              ...(position.placement === 'below'
                ? { top: position.top }
                : { top: position.top, transform: 'translateY(-100%)' })
            }}
            className="select-pop z-50 m-0 list-none overflow-y-auto rounded-box border border-[color:var(--rule)] bg-ash p-1 shadow-[0_12px_32px_rgb(0_0_0/0.45)]"
          >
            {options.map((option, index) => {
              const isSelected = index === selectedIndex;
              return (
                <li
                  key={option.value}
                  id={`${id}-opt-${index}`}
                  data-index={index}
                  role="option"
                  aria-selected={isSelected}
                  onPointerEnter={() => setActive(index)}
                  onClick={() => pick(index)}
                  className={`flex cursor-pointer items-start gap-2 rounded-[6px] px-2.5 py-2 ${
                    index === active ? 'bg-ash-hi' : ''
                  }`}
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className={isSelected ? 'text-ember' : 'text-paper'}>{option.label}</span>
                    {option.hint && <span className="text-xs text-taupe">{option.hint}</span>}
                  </span>
                  {isSelected && <Check className="mt-0.5 h-4 w-4 shrink-0 text-ember" aria-hidden="true" />}
                </li>
              );
            })}
          </ul>,
          // Inside a modal <dialog>, only its own subtree is in the top layer; body would sit behind it.
          triggerRef.current?.closest('dialog') ?? document.body
        )}
    </div>
  );
}
