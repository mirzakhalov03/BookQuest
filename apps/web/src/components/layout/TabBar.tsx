import type { LucideIcon } from 'lucide-react';
import { Sparkles, BookOpen, Trophy, BarChart3, User, PencilLine } from 'lucide-react';
import { NavLink, useLocation } from 'react-router';
import { isResultsOut } from '@bookquest/shared';
import { useCurrentQuest } from '@/lib/api/quest';
import { useT } from '@/i18n';

interface Tab {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Other paths that belong to this tab. */
  alsoMatches?: string;
}

/**
 * The five destinations. Product knowledge stays limited to where the app goes
 * (spec §4 rule 3) — the one exception is the fourth slot, which follows the
 * quest's `resultsAt`: Quiz until results are published (review and late
 * states live there until then), then Results.
 */
function useTabs(): Tab[] {
  const t = useT().nav;
  const { data: quest, isError } = useCurrentQuest();
  // No current quest means no quiz to point at; the last results are the useful place.
  const quizOver = (quest && isResultsOut(quest)) || isError;

  return [
    { to: '/', label: t.stage, icon: Sparkles },
    { to: '/book', label: t.book, icon: BookOpen },
    quizOver
      ? { to: '/results', label: t.results, icon: BarChart3 }
      : { to: '/quiz', label: t.quiz, icon: PencilLine },
    { to: '/prizes', label: t.prizes, icon: Trophy, alsoMatches: '/quests/' },
    { to: '/me', label: t.profile, icon: User }
  ];
}

/**
 * Bottom navigation. Styling is `.tabbar` / `.tab` in `styles/shell.css`, with
 * the ≥900px recomposition into a floating pill in `styles/stage.css`.
 *
 * Active state comes from the URL, never from a `useState` (spec §5): `NavLink`
 * reads the router and also sets `aria-current="page"` itself, which is why
 * there is no `aria-current` in the markup below.
 */
export function TabBar() {
  const { pathname } = useLocation();
  const tabs = useTabs();
  const t = useT();

  return (
    <nav className="tabbar" aria-label={t.nav.sections}>
      {tabs.map(({ to, label, icon: Icon, alsoMatches }) => (
        <NavLink
          key={to}
          to={to}
          // Only the Stage tab needs `end`. Every other tab should stay lit on
          // its own sub-routes. A past edition (/quests/2) lives under Prizes.
          end={to === '/'}
          className={({ isActive }) =>
            isActive || (alsoMatches && pathname.startsWith(alsoMatches)) ? 'tab is-on' : 'tab'
          }
        >
          <Icon className="tab__icon" aria-hidden="true" />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
