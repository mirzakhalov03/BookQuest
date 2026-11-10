import type { InteractionKind } from '@bookquest/shared';

export const KIND_LABEL: Record<InteractionKind, string> = {
  text: 'Text',
  command: 'Command',
  button: 'Button',
  contact: 'Contact',
  media: 'Media',
  location: 'Location',
  web_app_data: 'App data',
  membership: 'Access',
  other: 'Other'
};

// Gold for what a person wrote or shared; quiet for machine-ish events.
const LOUD = new Set<InteractionKind>(['text', 'contact', 'media', 'location']);

export function KindChip({ kind }: { kind: InteractionKind }) {
  return (
    <span
      className={`inline-flex shrink-0 rounded-full border px-2 py-0.5 text-xs ${
        LOUD.has(kind) ? 'border-gold/40 text-gold' : 'border-[color:var(--rule)] text-taupe'
      }`}
    >
      {KIND_LABEL[kind]}
    </span>
  );
}
