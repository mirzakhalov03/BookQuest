import type { BookResourceKind } from '@bookquest/shared';
import type { SelectOption } from '@/components/ui/Select';

export const RESOURCE_LIMIT = 12;

export const KIND_OPTIONS: readonly SelectOption<BookResourceKind>[] = [
  { value: 'pdf', label: 'PDF' },
  { value: 'epub', label: 'EPUB' },
  { value: 'audio', label: 'Audio' },
  { value: 'link', label: 'Link' }
];

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
      return 'Audiobook';
    case 'link':
      return hostnameOf(url);
  }
}
