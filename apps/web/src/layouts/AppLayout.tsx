import { Outlet } from 'react-router';
import { Toast } from '@/components/ui/Toast';

/**
 * The shell every screen sits in: atmosphere behind, content in the middle,
 * bottom navigation once there is more than one destination.
 *
 * Toast is mounted here because it is a single, app-wide element (spec §4) —
 * whatever screen fires one, this is where it renders. A later task rebuilds
 * this layout around the tab bar; this is deliberately the smallest possible
 * addition so that rebuild has one line to carry over, not a merge.
 */
export function AppLayout() {
  return (
    <div className="relative flex min-h-dvh flex-col">
      <div
        aria-hidden
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(70%_48%_at_50%_6%,rgba(240,160,60,0.16),transparent_68%),linear-gradient(180deg,#17120D_0%,var(--color-ink)_38%,var(--color-void)_100%)]"
      />
      <main className="relative z-10 flex flex-1 flex-col">
        <Outlet />
      </main>
      <Toast />
    </div>
  );
}
