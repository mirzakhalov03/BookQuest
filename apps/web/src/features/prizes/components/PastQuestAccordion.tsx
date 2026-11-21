import { useId } from 'react';
import { Link } from 'react-router';
import { ChevronDown } from 'lucide-react';
import type { QuestSummary } from '@bookquest/shared';
import { ArrowIcon } from '@/components/ui/ArrowIcon';
import { useT } from '@/i18n';
import { PrizePhoto } from './PrizePhoto';
import { PrizeList } from './PrizeList';

interface PastQuestAccordionProps {
  quest: QuestSummary;
  open: boolean;
  onToggle: () => void;
}

/** One past edition: closed it's a line, open it shows that year's prize poster. */
export function PastQuestAccordion({ quest, open, onToggle }: PastQuestAccordionProps) {
  const t = useT();
  const id = useId();
  const edition = t.common.editionShort(quest.edition, quest.year);

  return (
    <div className="border-b border-[var(--rule)] last:border-none">
      <h3 className="m-0">
        <button
          type="button"
          id={`${id}-head`}
          aria-expanded={open}
          aria-controls={`${id}-panel`}
          onClick={onToggle}
          className="group flex w-full items-center gap-4 py-4 text-left"
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="type-label">{edition}</span>
            <span className="type-display truncate text-lg text-paper">{quest.bookTitle}</span>
          </span>
          <ChevronDown
            className={`h-5 w-5 shrink-0 text-taupe transition-transform duration-200 group-hover:text-paper-dim ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
      </h3>

      <div className="past-panel" data-open={open}>
        <div id={`${id}-panel`} role="region" aria-labelledby={`${id}-head`} inert={!open}>
          <div className="flex flex-col gap-3 pb-5">
            {quest.prizes.photoUrl ? (
              <PrizePhoto src={quest.prizes.photoUrl} label={edition} />
            ) : (
              <PrizeList prizes={quest.prizes} upTo={3} />
            )}
            <Link
              to={`/quests/${quest.edition}`}
              className="group inline-flex items-center gap-2 self-start text-sm text-paper-dim hover:text-paper"
            >
              {t.prizes.fullEdition} <ArrowIcon />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
