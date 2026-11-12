import type { InteractionKind } from '@bookquest/shared';
import { useT } from '@/i18n';


// Gold for what a person wrote or shared; quiet for machine-ish events.
const LOUD = new Set<InteractionKind>(['text', 'contact', 'media', 'location']);

export function KindChip({ kind }: { kind: InteractionKind }) {
  const t = useT();
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs ${
        LOUD.has(kind) ? 'border-gold/40 text-gold' : 'border-[color:var(--rule)] text-taupe'
      }`}
    >
      {t.admin.messages.kinds[kind]}
    </span>
  );
}
