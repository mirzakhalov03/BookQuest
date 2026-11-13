import { BOOK_RESOURCE_KINDS, type BookResourceKind } from '@bookquest/shared';
import type { SelectOption } from '@/components/ui/Select';
import { getT } from '@/i18n';

export const RESOURCE_LIMIT = 12;

export function kindOptions(): SelectOption<BookResourceKind>[] {
  const kinds = getT().adminQuest.resources.kinds;
  return BOOK_RESOURCE_KINDS.map((value) => ({ value, label: kinds[value] }));
}

// Shops and maps, so a pasted Asaxiy or Google Maps link lands under "Where to find it".
const STORE_HOSTS = ['asaxiy.uz', 'book.uz', 'kitobxon.com', 'uzum.uz', 'amazon.', 'maps.google.', 'maps.app.goo.gl', 'yandex.uz'];

const AUDIO_HOSTS = ['audible.', 'storytel.', 'soundcloud.com', 'podcasts.apple.com', 'open.spotify.com', 'music.youtube.com'];

/** A best guess the admin can still change — it only saves them picking from a list. */
export function inferKind(url: string): BookResourceKind {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return 'link';
  }
  const path = parsed.pathname.toLowerCase();
  if (path.endsWith('.pdf')) return 'pdf';
  if (path.endsWith('.epub')) return 'epub';
  if (/\.(mp3|m4a|m4b|aac|ogg)$/.test(path) || AUDIO_HOSTS.some((host) => parsed.hostname.includes(host))) {
    return 'audio';
  }
  if (STORE_HOSTS.some((host) => parsed.hostname.includes(host)) || path.startsWith('/maps')) return 'store';
  return 'link';
}

export function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function defaultLabel(kind: BookResourceKind, url: string): string {
  switch (kind) {
    case 'pdf':
      return 'PDF';
    case 'epub':
      return 'EPUB';
    case 'audio':
      return getT().adminQuest.resources.audiobook;
    case 'link':
    case 'store':
      return hostnameOf(url);
  }
}
