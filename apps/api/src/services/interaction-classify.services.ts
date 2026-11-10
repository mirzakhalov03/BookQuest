import type { InteractionInput } from '@bookquest/shared';

type Classifiable = Pick<InteractionInput, 'kind' | 'command' | 'commandArgs' | 'inReplyTo'>;

/**
 * "Signal": a person said or did something worth reading. Stored, not computed
 * at read time, so the default view is one indexed query; change a rule here,
 * then run `pnpm --filter @bookquest/api reclassify:interactions`.
 */
export function isSignal(item: Classifiable): boolean {
  if (item.inReplyTo) return true;
  switch (item.kind) {
    case 'text':
    case 'contact':
    case 'media':
    case 'location':
    case 'web_app_data':
      return true;
    case 'command':
      return item.command !== 'start' || !!item.commandArgs;
    default:
      return false;
  }
}
