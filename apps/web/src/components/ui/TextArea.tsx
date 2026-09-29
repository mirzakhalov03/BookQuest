import { forwardRef, useId, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { fieldLineClass, type FieldStatus } from './Field';

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
        className={`w-full resize-y border-0 border-b bg-transparent px-[0.15rem] py-2 text-base text-paper placeholder:text-taupe focus:outline-none ${fieldLineClass(status)}`}
      />
      <p
        id={msgId}
        role="status"
        className={`m-0 min-h-[1.15rem] text-sm leading-[1.35] ${status === 'bad' ? 'text-error' : 'text-taupe'}`}
      >
        {message}
      </p>
    </div>
  );
});
