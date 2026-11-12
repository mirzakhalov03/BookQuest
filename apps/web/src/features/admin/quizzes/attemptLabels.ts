import type { AttemptStatus, ItemOutcome, QuizFlag } from '@bookquest/shared';

export const STATUS_LABEL: Record<AttemptStatus, string> = {
  in_progress: 'In progress',
  completed: 'Completed',
  voided: 'Voided'
};

export const FLAG_LABEL: Record<QuizFlag, string> = {
  multi_client: 'Many devices',
  fast: 'Fast',
  hidden: 'Left the app',
  refund_capped: 'Time claims capped'
};

export const OUTCOME_LABEL: Record<ItemOutcome, string> = {
  locked: 'Locked',
  auto: 'Auto-locked',
  timeout: 'Timed out',
  unserved: 'Not reached'
};
