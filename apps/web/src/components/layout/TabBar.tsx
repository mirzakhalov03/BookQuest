import type { LucideIcon } from 'lucide-react';
import { Sparkles, BookOpen, ListChecks, BarChart3, User } from 'lucide-react';
import { NavLink } from 'react-router';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
}

/**
 * The five destinations of the design, in the prototype's order. This is the
 * whole of the product knowledge a layout primitive is allowed (spec §4 rule
 * 3): where the app goes, not what is there when it arrives.
 */
const TABS: Tab[] = [
  { to: '/', label: 'Stage', icon: Sparkles },
  { to: '/book', label: 'Book', icon: BookOpen },
  { to: '/quests', label: 'Quests', icon: ListChecks },
  { to: '/results', label: 'Results', icon: BarChart3 },
  { to: '/me', label: 'You', icon: User }
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
      {TABS.map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          // Only the Stage tab needs `end`. Every other tab should stay lit on
          // its own sub-routes — /quests/2024 is still Quests.
          end={to === '/'}
          className={({ isActive }) => (isActive ? 'tab is-on' : 'tab')}
        >
          <Icon className="tab__icon" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
