import { Outlet, useLocation } from 'react-router';
import { TabBar } from '@/components/layout/TabBar';
import { Toast } from '@/components/ui/Toast';

/**
 * The shell every screen sits in: atmosphere behind, content in the middle,
 * bottom navigation under it.
 *
 * Toast is mounted here because it is a single, app-wide element (spec §4) —
 * whatever screen fires one, this is where it renders, admin included:
 * `AdminLayout` nests inside this one rather than duplicating the shell.
 *
 * There is no TopBar here on purpose. The wordmark carries `quest.year`, and
 * putting it in the layout would either hardcode the year or make every route
 * — the registration title page included, which is deliberately bare — wait on
 * the quest query. Screens mount their own (spec §4).
 */
export function AppLayout() {
  const { pathname } = useLocation();
  // Chrome-less routes: no *participant* bottom tab bar. The admin area
  // (`AdminLayout`) renders its own bottom tab bar for its own five
  // destinations, so it stays off this one rather than getting two. The
  // title page and its reveal are the one screen the design (spec §4,
  // `prototype/index.html` views 1/2) never puts a tab bar under either —
  // there is nowhere for it to navigate *to* before a place is claimed.
  // Path-gated rather than a second layout root so every chrome-less route
  // still keeps the one atmosphere and the one Toast every other route gets.
  const isChromeless =
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/register' ||
    pathname === '/register/success';

  return (
    <div className="relative flex min-h-dvh flex-col">
      <Atmosphere />

      {/* Below the tab bar's z-index, so a sticky bar is never painted over by
          the screen scrolling under it. */}
      <main className="relative z-[1] flex flex-1 flex-col">
        {/* Keyed on the path so the enter animation restarts on every
            navigation — a class alone would only ever run once. */}
        <div key={pathname} className="view flex flex-1 flex-col">
          <Outlet />
        </div>
      </main>

      {!isChromeless && <TabBar />}
      <Toast />
    </div>
  );
}

/**
 * Three fixed layers — ruling, wash, grain — behind everything (`shell.css`).
 * Decorative in full: nothing here is content, so the whole stack is hidden
 * from assistive tech at the root rather than layer by layer.
 */
function Atmosphere() {
  return (
    <div aria-hidden className="atmos">
      <div className="atmos__rules" />
      <div className="atmos__wash" />
      <div className="atmos__grain" />
    </div>
  );
}
