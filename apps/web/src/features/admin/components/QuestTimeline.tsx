import { Fragment, type ReactNode } from 'react';
import { QUEST_DATE_FIELDS, type QuestDateField } from '@bookquest/shared';
import { DATE_LABEL, GAP_LABEL, formatGap } from '../dates';

interface QuestTimelineProps {
  dates: Record<QuestDateField, Date | null>;
  now: Date;
  /** An input in the editor, formatted text on the Dashboard. */
  renderValue: (field: QuestDateField) => ReactNode;
}

type NodeState = 'passed' | 'next' | 'future';

const DOT: Record<NodeState, string> = {
  passed: 'bg-taupe-dim',
  next: 'bg-ember shadow-[0_0_0_4px_rgba(226,99,42,0.2)]',
  future: 'border border-[color:var(--rule-strong)] bg-ink'
};

/** The five dates as one rail: what's passed, what's next, how long each stretch is. */
export function QuestTimeline({ dates, now, renderValue }: QuestTimelineProps) {
  const firstFuture = QUEST_DATE_FIELDS.findIndex((field) => {
    const date = dates[field];
    return date === null || date > now;
  });
  // "Now" sits just before the first future date — or after the last one once everything has passed.
  const nowIndex = firstFuture === -1 ? QUEST_DATE_FIELDS.length : firstFuture;

  return (
    <ol className="relative m-0 flex list-none flex-col p-0 before:absolute before:bottom-3 before:left-[0.55rem] before:top-3 before:w-px before:bg-[color:var(--rule-strong)]">
      {QUEST_DATE_FIELDS.map((field, index) => {
        const state: NodeState = index < nowIndex ? 'passed' : index === nowIndex ? 'next' : 'future';
        const nextField = QUEST_DATE_FIELDS[index + 1];
        const gap = nextField ? formatGap(dates[field], dates[nextField]) : null;

        return (
          <Fragment key={field}>
            {index === nowIndex && index > 0 && <NowMarker />}
            <li className="relative grid grid-cols-[1.1rem_1fr] gap-x-3 py-2">
              <span aria-hidden className={`relative z-[1] mt-1 h-2.5 w-2.5 justify-self-center rounded-full ${DOT[state]}`} />
              <div className="flex min-w-0 flex-col gap-1">
                <span className="type-label">{DATE_LABEL[field]}</span>
                {renderValue(field)}
              </div>
            </li>
            {gap && GAP_LABEL[field] && (
              <li aria-hidden className="grid grid-cols-[1.1rem_1fr] gap-x-3 pb-1">
                <span />
                <span className="text-xs text-taupe-dim">
                  {GAP_LABEL[field]} · {gap}
                </span>
              </li>
            )}
          </Fragment>
        );
      })}
      {nowIndex === QUEST_DATE_FIELDS.length && <NowMarker />}
    </ol>
  );
}

function NowMarker() {
  return (
    <li className="grid grid-cols-[1.1rem_1fr] items-center gap-x-3 py-1">
      <span aria-hidden className="relative z-[1] h-px w-full bg-ember" />
      <span className="type-label text-ember">Now</span>
    </li>
  );
}
