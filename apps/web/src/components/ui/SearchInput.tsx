import type { InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { fieldLineClass, fieldSurfaceClass } from './Field';

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> {
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
}

export function SearchInput({ value, onChange, className = '', ...props }: SearchInputProps) {
  return (
    <div className={`relative ${className}`}>
      <Search
        aria-hidden
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-taupe"
      />
      <input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full pl-9 pr-3 text-base text-paper placeholder:text-taupe transition-[border-color,box-shadow] duration-[180ms] focus:outline-none ${fieldSurfaceClass} ${fieldLineClass()}`}
      />
    </div>
  );
}
