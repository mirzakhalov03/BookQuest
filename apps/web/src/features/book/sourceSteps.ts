/** Admin text → clean steps: one per line, typed "1." numbering dropped (the list numbers them). */
export function sourceSteps(guide: string | null, fallback: readonly string[]): string[] {
  const steps = (guide ?? '')
    .split('\n')
    .map((line) => line.trim().replace(/^\d+[.)]\s*/, ''))
    .filter(Boolean);
  return steps.length > 0 ? steps : [...fallback];
}
