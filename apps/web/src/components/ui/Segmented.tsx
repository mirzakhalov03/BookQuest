interface SegmentedProps<Value extends string> {
  options: readonly { value: Value; label: string }[];
  value: Value;
  onChange: (value: Value) => void;
  'aria-label': string;
  className?: string;
}

/** A pill row for 2–4 mutually exclusive choices; `Switch` stays the underlined two-tab pair. */
export function Segmented<Value extends string>({
  options,
  value,
  onChange,
  'aria-label': ariaLabel,
  className = ''
}: SegmentedProps<Value>) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className={`inline-flex overflow-hidden rounded-box border border-[color:var(--rule-strong)] ${className}`}
    >
      {options.map((option) => {
        const isOn = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={isOn}
            onClick={() => onChange(option.value)}
            className={`min-h-11 flex-1 px-3 text-sm font-medium transition-colors disabled:opacity-50 ${
              isOn ? 'bg-ash-hi text-amber' : 'text-taupe hover:text-paper-dim'
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
