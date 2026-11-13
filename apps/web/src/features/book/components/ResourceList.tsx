import { ArrowUpRight } from 'lucide-react';
import type { BookResource } from '@bookquest/shared';
import { EmptyState } from '@/components/feedback/EmptyState';
import { openExternalLink } from '@/lib/telegram';
import { ResourceIcon } from '@/components/ResourceIcon';
import { useT } from '@/i18n';

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
  const t = useT().book;
  if (resources.length === 0) {
    return (
      <section className="flex flex-1 flex-col gap-2">
        <p className="type-label">{t.whereToRead}</p>
        <EmptyState title={t.noResourcesTitle} titleAs="h2" body={t.noResourcesBody} />
      </section>
    );
  }

  // Entry order is kept within each group; an empty group isn't rendered.
  const stores = resources.filter((resource) => resource.kind === 'store');
  const copies = resources.filter((resource) => resource.kind !== 'store');

  return (
    <>
      {copies.length > 0 && <ResourceGroup heading={t.readOrListen} resources={copies} />}
      {stores.length > 0 && <ResourceGroup heading={t.whereToFind} resources={stores} />}
    </>
  );
}

function ResourceGroup({ heading, resources }: { heading: string; resources: BookResource[] }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="type-label">{heading}</h2>
      <ul className="flex flex-col">
        {resources.map((resource) => (
          <li key={resource.url} className="border-b border-[var(--rule)] last:border-none">
            {/* External link, opened safely — this leaves the app to a domain
                BookQuest does not control. Stays an ordinary anchor so it can
                still be middle-clicked, copied and read by assistive tech; the
                click handler only takes over when Telegram's own `openLink` is
                there to open it outside the Mini App sheet, where
                `target="_blank"` is unreliable. */}
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
              <ArrowUpRight
                className="h-4 w-4 shrink-0 text-taupe transition-colors group-hover:text-paper-dim"
                aria-hidden="true"
              />
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}
