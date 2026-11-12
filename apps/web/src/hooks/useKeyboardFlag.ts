import { useEffect } from 'react';

const NON_TEXT_INPUTS = new Set(['button', 'submit', 'reset', 'checkbox', 'radio', 'range', 'color', 'file', 'image', 'hidden']);

/** Anything that raises the on-screen keyboard (or iOS's picker wheel). */
function opensKeyboard(el: Element | null): boolean {
  if (el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return true;
  if (el instanceof HTMLInputElement) return !NON_TEXT_INPUTS.has(el.type);
  return el instanceof HTMLElement && el.isContentEditable;
}

/**
 * Flags `<html data-keyboard>` while a text field has focus, so CSS can drop the
 * sticky tab bar instead of letting it ride up on top of the keyboard (`shell.css`).
 * Focus, not `visualViewport`: Telegram's webview resizes inconsistently, focus is exact.
 */
export function useKeyboardFlag(): void {
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => root.toggleAttribute('data-keyboard', opensKeyboard(document.activeElement));
    // focusout fires before focus reaches the next field; a frame's wait stops the bar flashing between fields.
    let frame = 0;
    const syncNextFrame = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    };

    document.addEventListener('focusin', sync);
    document.addEventListener('focusout', syncNextFrame);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', sync);
      document.removeEventListener('focusout', syncNextFrame);
      root.removeAttribute('data-keyboard');
    };
  }, []);
}
