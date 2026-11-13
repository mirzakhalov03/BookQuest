import { useId } from 'react';

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}

/** An on/off switch with its label and hint (`Switch` is a two-option tab pair, not this). */
export function Toggle({ checked, onChange, label, hint, disabled = false }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={id} className="text-paper">
          {label}
        </label>
        {hint && (
          <p id={`${id}-hint`} className="m-0 text-sm text-taupe">
            {hint}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        // 44px tall hit area around a 28px track.
        className="group relative flex min-h-11 shrink-0 items-center rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ember disabled:opacity-50"
      >
        <span
          className={`flex h-7 w-12 items-center rounded-full p-0.5 transition-colors duration-200 ${
            checked ? 'bg-ember' : 'bg-ash-hi'
          }`}
        >
          <span
            className={`size-6 rounded-full bg-paper shadow transition-transform duration-200 ease-[var(--ease-out-quest)] ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`}
          />
        </span>
      </button>
    </div>
  );
}
