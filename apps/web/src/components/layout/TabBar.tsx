import type { ReactNode } from 'react';
import { NavLink } from 'react-router';

interface Tab {
  to: string;
  label: string;
  /** The icon's paths. The `<svg>` around them is the same for all five. */
  icon: ReactNode;
}

/**
 * The five destinations of the design, in the prototype's order and with its
 * icons. This is the whole of the product knowledge a layout primitive is
 * allowed (spec §4 rule 3): where the app goes, not what is there when it
 * arrives.
 */
const TABS: Tab[] = [
  {
    to: '/',
    label: 'Stage',
    icon: (
      <>
        <circle cx="12" cy="10" r="5" />
        <path d="M4 19h16" />
      </>
    )
  },
  {
    to: '/book',
    label: 'Book',
    icon: (
      <>
        <path d="M6 4h12v16H6z" />
        <path d="M9 4v16" />
      </>
    )
  },
  { to: '/quests', label: 'Quests', icon: <path d="M5 6h14M5 12h10M5 18h6" /> },
  { to: '/results', label: 'Results', icon: <path d="M5 20V14M12 20V6M19 20v-9" /> },
  { to: '/me', label: 'You', icon: <path d="M7 4h10v16l-5-4-5 4z" /> }
];

/**
 * Bottom navigation. Styling is `.tabbar` / `.tab` in `styles/shell.css`, with
 * the ≥900px recomposition into a floating pill in `styles/stage.css`.
 *
 * Active state comes from the URL, never from a `useState` (spec §5): `NavLink`
 * reads the router and also sets `aria-current="page"` itself, which is why
 * there is no `aria-current` in the markup below.
 */
export function TabBar() {
  return (
    <nav className="tabbar" aria-label="Sections">
      {TABS.map(({ to, label, icon }) => (
        <NavLink
          key={to}
          to={to}
          // Only the Stage tab needs `end`. Every other tab should stay lit on
          // its own sub-routes — /quests/2024 is still Quests.
          end={to === '/'}
          className={({ isActive }) => (isActive ? 'tab is-on' : 'tab')}
        >
          <svg className="tab__icon" viewBox="0 0 24 24" aria-hidden="true">
            {icon}
          </svg>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
