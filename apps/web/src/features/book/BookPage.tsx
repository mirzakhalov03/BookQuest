import { useCurrentQuest } from '@/features/home/api/useCurrentQuest';
import { BookHero } from '@/components/BookHero';
import { Screen } from '@/components/layout/Screen';
import { LoadingState } from '@/components/feedback/LoadingState';
import { ErrorState } from '@/components/feedback/ErrorState';
import { EmptyState } from '@/components/feedback/EmptyState';
import { ApiRequestError } from '@/lib/api/client';
import { ResourceList } from './components/ResourceList';

/**
 * The book behind the current quest. Fed by `useCurrentQuest()` — the same
 * cached query Home reads — rather than a second fetch of the same endpoint
 * (spec §6): the Home screen and this one are two views onto one resource.
 *
 * A tab-bar destination, not a screen someone drills into, so there is no
 * Telegram back button here — see `useTelegramBackButton`'s own reasoning for
 * why it names a parent, and this screen doesn't have one.
 */
export function BookPage() {
  const { data: quest, isPending, error, refetch } = useCurrentQuest();

  if (isPending) return <LoadingState label="Opening the book…" />;

  if (error) {
    // Same "between editions" condition Home handles, met by the same query —
    // an invitation to come back, not a failure to retry (spec, plan Phase 3).
    if (error instanceof ApiRequestError && error.status === 404 && error.code === 'not_found') {
      return (
        <Screen>
          <EmptyState title={error.message} body="Check back once the next edition opens." />
        </Screen>
      );
    }
    return (
      <Screen>
        <ErrorState error={error} onRetry={() => refetch()} />
      </Screen>
    );
  }

  return (
    <Screen className="gap-8">
      <BookHero
        edition={quest.edition}
        year={quest.year}
        title={quest.book.title}
        author={quest.book.author}
        pages={quest.book.pages}
        coverUrl={quest.book.coverUrl}
      />

      {/* Backend-owned and nullable (spec §11) — an admin who hasn't written
          one yet leaves nothing here rather than a placeholder paragraph. */}
      {quest.book.description && (
        <section className="flex flex-col gap-2">
          <p className="type-label">About the book</p>
          <p className="text-paper-dim">{quest.book.description}</p>
        </section>
      )}

      <section className="flex flex-1 flex-col gap-2">
        <p className="type-label">Where to read it</p>
        <ResourceList resources={quest.book.resources} />
      </section>
    </Screen>
  );
}
