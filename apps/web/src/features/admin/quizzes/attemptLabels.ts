import { QUIZ_FLAG_LABEL, type AttemptStatus, type ItemOutcome } from '@bookquest/shared';

export const STATUS_LABEL: Record<AttemptStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  voided: 'Voided'
};

export const FLAG_LABEL = QUIZ_FLAG_LABEL;

export const OUTCOME_LABEL: Record<ItemOutcome, string> = {
  locked: 'Locked',
  auto: 'Auto-locked',
  timeout: 'Timed out',
  unserved: 'Not reached'
};
