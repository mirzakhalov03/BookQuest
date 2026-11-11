import { useEffect } from 'react';
import type { QuestionType } from '@bookquest/shared';
import { OptionButton, type OptionState } from './OptionButton';

interface QuestionCardProps {
  question: { type: QuestionType; prompt: string; options: { id: string; text: string }[] };
  selectedOptionId: string | null;
  lockedOptionId?: string | null;
  /** Admin preview and review only; never set during play. */
  revealCorrectOptionId?: string | null;
  disabled?: boolean;
  onSelect: (optionId: string) => void;
}

const LETTERS = 'ABCDEF';

const isTypingTarget = (target: EventTarget | null) =>
  target instanceof HTMLElement && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName));

export function QuestionCard({
  question,
  selectedOptionId,
  lockedOptionId = null,
  revealCorrectOptionId = null,
  disabled = false,
  onSelect
}: QuestionCardProps) {
  const { type, prompt, options } = question;
  const isTrueFalse = type === 'true_false';

  // Keys 1-6 pick an option; skipped while typing elsewhere or when modified (browser shortcuts).
  useEffect(() => {
    if (disabled) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey || isTypingTarget(event.target)) return;
      const option = /^[1-6]$/.test(event.key) ? options[Number(event.key) - 1] : undefined;
      if (option) onSelect(option.id);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [disabled, options, onSelect]);

  function stateOf(optionId: string): OptionState {
    if (revealCorrectOptionId) {
      if (optionId === revealCorrectOptionId) return 'correct';
      if (optionId === (lockedOptionId ?? selectedOptionId)) return 'wrong';
    }
    if (optionId === lockedOptionId) return 'locked';
    return optionId === selectedOptionId ? 'selected' : 'idle';
  }

  return (
    <section className="flex flex-col gap-6">
      <h2 className="m-0 select-none break-words text-xl font-semibold leading-snug text-paper md:text-2xl">
        {prompt}
      </h2>
      <div className={isTrueFalse ? 'grid grid-cols-2 gap-3' : 'flex flex-col gap-3'}>
        {options.map((option, index) => (
          <OptionButton
            key={option.id}
            letter={isTrueFalse ? null : (LETTERS[index] ?? null)}
            text={option.text}
            state={stateOf(option.id)}
            disabled={disabled}
            onClick={() => onSelect(option.id)}
          />
        ))}
      </div>
    </section>
  );
}
