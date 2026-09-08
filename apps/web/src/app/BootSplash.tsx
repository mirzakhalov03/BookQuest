/**
 * What the app is while it works out who is using it.
 *
 * Deliberately not a spinner: on the open web the session resolves without a
 * single request, so this is usually one frame, and a spinner appearing and
 * vanishing that fast reads as a glitch. The wordmark on the same dark ground
 * the shell uses just looks like the app opening.
 *
 * This is not the shared LoadingState — that belongs to the screens, and to a
 * later task. This one only ever runs before the router exists.
 */
export function BootSplash() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-ink px-6 text-center">
      <p className="type-display animate-breathe text-4xl">BookQuest</p>
      <p className="type-label">One book. One deadline. One quiz.</p>
    </div>
  );
}
