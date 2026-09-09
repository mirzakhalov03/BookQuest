import { Button } from '@/components/ui/Button';
import { formatCount } from '@/lib/format';

interface ParticipantsPagerProps {
  page: number;
  limit: number;
  total: number;
  onPageChange: (page: number) => void;
  /** Disables both buttons mid-fetch so a fast double-click can't skip a page. */
  isFetching: boolean;
}

/**
 * Prev/Next against a `Paginated`'s `page`/`limit`/`total` — there is no
 * cursor to page with here, unlike the archive's "Load more" (spec: the
 * contract for this endpoint is page/limit/total, not `nextCursor`).
 */
export function ParticipantsPager({ page, limit, total, onPageChange, isFetching }: ParticipantsPagerProps) {
  const lastPage = Math.max(1, Math.ceil(total / limit));

  return (
    <div className="flex items-center justify-between gap-4 pt-2">
      <Button
        variant="quiet"
        disabled={page <= 1 || isFetching}
        onClick={() => onPageChange(page - 1)}
      >
        Previous
      </Button>

      <p className="text-sm text-taupe">
        Page {formatCount(page)} of {formatCount(lastPage)}
      </p>

      <Button
        variant="quiet"
        disabled={page >= lastPage || isFetching}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </Button>
    </div>
  );
}
