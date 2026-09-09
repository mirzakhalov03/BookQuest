import type { BookResource } from '@bookquest/shared';
import { EmptyState } from '@/components/feedback/EmptyState';
import { openExternalLink } from '@/lib/telegram';
import { ResourceIcon } from './ResourceIcon';

interface ResourceListProps {
  resources: BookResource[];
}

/**
 * Where to actually read the book. `resources` is admin-set and starts empty
 * (spec §11) — the seeded quest has none yet, which is the state this screen
 * will actually be seen in first. An empty shelf is a normal gap between an
 * edition opening and an organiser adding a link, not a failure, so it gets
 * the same invitation voice as any other `EmptyState`.
 *
 * Links are public (resolved TBD-4): `GET /quests/current` already serves
 * `book.resources` unauthenticated, so gating them behind `RequireAuth` here
 * would be theatre, not a real barrier.
 */
export function ResourceList({ resources }: ResourceListProps) {
  if (resources.length === 0) {
    return (
      <EmptyState
        title="Nowhere to read it yet"
        titleAs="h2"
        body="The organisers haven't linked a copy for this edition. Check back closer to the deadline."
      />
    );
  }

  return (
    <ul className="flex flex-col">
      {resources.map((resource) => (
        <li key={resource.url} className="border-b border-[var(--rule)] last:border-none">
          {/* External link, opened safely — this leaves the app to a domain
              BookQuest does not control. Stays an ordinary anchor so it can
              still be middle-clicked, copied and read by assistive tech
              (`TopBar`'s `WebLink` does the same); the click handler only
              takes over when Telegram's own `openLink` is there to open it
              outside the Mini App sheet, where `target="_blank"` is
              unreliable — and this screen's whole purpose is these links. */}
          <a
            href={resource.url}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(event) => {
              if (openExternalLink(resource.url)) event.preventDefault();
            }}
            className="group flex items-center gap-3 py-4 text-paper-dim transition-colors hover:text-paper"
          >
            <ResourceIcon kind={resource.kind} />
            <span className="flex-1">{resource.label}</span>
            <span aria-hidden="true" className="text-taupe transition-colors group-hover:text-paper-dim">
              ↗
            </span>
          </a>
        </li>
      ))}
    </ul>
  );
}
