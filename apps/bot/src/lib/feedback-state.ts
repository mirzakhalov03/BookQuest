/**
 * In memory on purpose: one long-polling process, and losing this on restart
 * costs a tap at most (the exit button and /start always work, and a stale
 * reply prompt is detected and explained).
 */

/** Participants currently in the feedback chat. */
const sessions = new Set<number>();

export const openFeedbackSession = (userId: number) => void sessions.add(userId);
export const closeFeedbackSession = (userId: number) => void sessions.delete(userId);
export const inFeedbackSession = (userId: number) => sessions.has(userId);

/** Reply-prompt message id in the group → the participant it answers. */
const prompts = new Map<number, number>();
// Unanswered prompts would otherwise pile up forever.
const PROMPT_CAP = 500;

export function rememberPrompt(promptMessageId: number, userId: number): void {
  prompts.set(promptMessageId, userId);
  if (prompts.size > PROMPT_CAP) prompts.delete(prompts.keys().next().value!);
}

/** One answer per tap, so a second message can't slip through by accident. */
export function takePrompt(promptMessageId: number): number | undefined {
  const userId = prompts.get(promptMessageId);
  prompts.delete(promptMessageId);
  return userId;
}
