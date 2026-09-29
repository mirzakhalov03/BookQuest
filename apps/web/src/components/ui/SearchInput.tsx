import type { InputHTMLAttributes } from 'react';
import { Search } from 'lucide-react';
import { fieldLineClass } from './Field';

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
        className="pointer-events-none absolute left-1 top-1/2 h-4 w-4 -translate-y-1/2 text-taupe"
      />
      <input
        {...props}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 w-full border-0 border-b bg-transparent pl-7 pr-1 text-base text-paper placeholder:text-taupe focus:outline-none ${fieldLineClass()}`}
      />
    </div>
  );
}
