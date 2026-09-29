import { useUiStore } from '@/stores/ui.store';

/**
 * The app's one transient message (spec §4). Always mounted, on or off —
 * the prototype keeps the same `<p>` in the DOM and toggles a class rather
 * than mounting and unmounting it, which is what lets the auto-dismiss just
 * be a fade instead of a remount. There is nothing to configure here: what
 * to say and how long it stays lives in ui.store, this just reflects it.
 */
export function Toast() {
  const message = useUiStore((state) => state.toastMessage);
  const isOn = message !== null;

  return (
    <p
      role="status"
      aria-live="polite"
      className={`fixed left-1/2 z-20 m-0 -translate-x-1/2 whitespace-nowrap rounded-box border border-[color:var(--rule)] bg-[rgba(33,27,21,0.94)] px-4 py-[0.6rem] text-sm text-paper-dim backdrop-blur-[10px] pointer-events-none bottom-[calc(var(--tabbar-h)+var(--safe-b)+1rem)] [transition:opacity_200ms_linear,transform_220ms_var(--ease-out-quest)] ${
        isOn ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'
      }`}
    >
      {message}
    </p>
  );
}
