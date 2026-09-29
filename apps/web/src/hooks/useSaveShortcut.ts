import { useEffect, useRef } from 'react';

/** ⌘S / Ctrl+S runs `onSave`; `null` still swallows the browser's own "save page" dialog. */
export function useSaveShortcut(onSave: (() => void) | null): void {
  const latest = useRef(onSave);

  useEffect(() => {
    latest.current = onSave;
  });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== 's') return;
      event.preventDefault();
      latest.current?.();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);
}
