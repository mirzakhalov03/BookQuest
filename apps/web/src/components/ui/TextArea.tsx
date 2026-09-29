import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { useFieldSize } from './fieldSize';
import { fieldLineClass, fieldSurfaceClass, type FieldStatus } from './Field';

export interface TextAreaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  id?: string;
  label: string;
  message?: string;
  status?: FieldStatus;
  /** Right side of the label row — a character counter, usually. */
  head?: ReactNode;
  className?: string;
}

/** `Field`'s multi-line sibling: same label, underline and message slot. */
export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { id, label, message, status, head, className = '', ...props },
  ref
) {
  const autoId = useId();
  const compact = useFieldSize() === 'compact';
  const fieldId = id ?? autoId;
  const msgId = `${fieldId}-msg`;

  return (
    <div className={`grid gap-[0.4rem] ${className}`}>
      <div className="flex items-baseline justify-between gap-4">
        <label htmlFor={fieldId} className="type-label">
          {label}
        </label>
        {head}
      </div>
      <textarea
        {...props}
        ref={ref}
        id={fieldId}
        aria-describedby={msgId}
        aria-invalid={status === 'bad' || undefined}
        className={`w-full resize-y px-3 py-2.5 text-base text-paper placeholder:text-taupe transition-[border-color,box-shadow] duration-[180ms] focus:outline-none ${fieldSurfaceClass} ${fieldLineClass(status)}`}
      />
      <p
        id={msgId}
        role="status"
        className={`m-0 text-sm ${compact ? 'empty:hidden' : 'min-h-[1.15rem]'} leading-[1.35] ${status === 'bad' ? 'text-error' : 'text-taupe'}`}
      >
        {message}
      </p>
    </div>
  );
});
