import { useId, type SelectHTMLAttributes } from 'react';
import { useFieldSize } from './fieldSize';
import { fieldLineClass, fieldSurfaceClass } from './Field';

export interface SelectOption<V extends string> {
  value: V;
  label: string;
}

interface SelectProps<V extends string>
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id' | 'value' | 'onChange'> {
  label: string;
  value: V;
  options: readonly SelectOption<V>[];
  onChange: (value: V) => void;
  className?: string;
}

/** A native select in `Field`'s clothes; native keeps the phone's own picker. */
export function Select<V extends string>({ label, value, options, onChange, className = '', ...props }: SelectProps<V>) {
  const id = useId();
  const compact = useFieldSize() === 'compact';

  return (
    <div className={`grid gap-[0.4rem] ${className}`}>
      <label htmlFor={id} className="type-label">
        {label}
      </label>
      <select
        {...props}
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value as V)}
        className={`${compact ? 'h-11' : 'h-[3.25rem]'} w-full px-3 text-base text-paper transition-[border-color,box-shadow] duration-[180ms] focus:outline-none ${fieldSurfaceClass} ${fieldLineClass()}`}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value} className="bg-ink text-paper">
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}
