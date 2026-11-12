import { Copy } from 'lucide-react';
import { useUiStore } from '@/stores/ui.store';
import { useT } from '@/i18n';

/** One tap copies; the toast says whether it worked, since a clipboard write can be refused. */
export function CopyButton({ value, label }: { value: string; label: string }) {
  const showToast = useUiStore((state) => state.showToast);
  const t = useT().admin;

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      showToast(t.copied);
    } catch {
      showToast(t.copyFailed);
    }
  }

  return (
    <button
      type="button"
      aria-label={label}
      onClick={() => void copy()}
      className="grid h-9 w-9 shrink-0 place-items-center text-taupe hover:text-paper"
    >
      <Copy aria-hidden className="h-4 w-4" />
    </button>
  );
}
