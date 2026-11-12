import { useEffect, useState, type ReactNode } from 'react';

const block = (event: { preventDefault: () => void }) => event.preventDefault();

/**
 * Screenshot deterrents. The web can't block captures, so this makes casual copying awkward
 * (no selection, copy or long-press menu) and blurs the question while the app is backgrounded or unfocused.
 */
export function QuizGuard({ children }: { children: ReactNode }) {
  const obscured = useObscured();

  return (
    <div
      className="quiz-guard flex flex-1 flex-col"
      data-obscured={obscured}
      onContextMenu={block}
      onCopy={block}
      onCut={block}
      onDragStart={block}
    >
      <div className="quiz-guard-content flex flex-1 flex-col">{children}</div>
    </div>
  );
}

/** Starts clear and only reacts to events: some webviews report no focus until the first tap. */
function useObscured(): boolean {
  const [obscured, setObscured] = useState(false);
  useEffect(() => {
    const hide = () => setObscured(true);
    const show = () => setObscured(false);
    const onVisibility = () => setObscured(document.visibilityState === 'hidden');
    window.addEventListener('blur', hide);
    window.addEventListener('focus', show);
    window.addEventListener('pointerdown', show);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('blur', hide);
      window.removeEventListener('focus', show);
      window.removeEventListener('pointerdown', show);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);
  return obscured;
}
