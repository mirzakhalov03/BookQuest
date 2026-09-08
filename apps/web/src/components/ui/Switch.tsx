interface SwitchOption<Value extends string> {
  value: Value;
  label: string;
}

interface SwitchProps<Value extends string> {
  /**
   * Exactly two — this is a tab pair, not a generic list. Spec §10's
   * discipline: build the shape the design has, not the shape it might
   * grow into.
   */
  options: readonly [SwitchOption<Value>, SwitchOption<Value>];
  value: Value;
  onChange: (value: Value) => void;
  /** Required, not optional — a tablist with no name is a tablist nobody using a screen reader can identify. */
  'aria-label': string;
  className?: string;
}

/**
 * Two-option underlined tab pair (spec §4). Generic over the option value so
 * the contact-method switch and a future filter switch are the same
 * component with different `options` — this file has no idea what
 * "Telegram" or "Phone" mean, only that it was handed two labelled values.
 */
export function Switch<Value extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className = ''
}: SwitchProps<Value>) {
  return (
    <div role="tablist" aria-label={ariaLabel} className={`flex gap-[1.1rem] ${className}`}>
      {options.map((option) => {
        const isOn = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={isOn}
            onClick={() => onChange(option.value)}
            className={`relative min-h-11 py-[0.35rem] text-sm transition-colors duration-[180ms] ${
              isOn ? 'text-paper' : 'text-taupe hover:text-paper-dim active:text-paper-dim'
            }`}
          >
            {option.label}
            <span
              aria-hidden
              className={`absolute inset-x-0 bottom-0 h-0.5 origin-left bg-ember transition-transform duration-[240ms] ease-[var(--ease-out-quest)] ${
                isOn ? 'scale-x-100' : 'scale-x-0'
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
