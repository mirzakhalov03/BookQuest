/**
 * The pull-to-refresh book: it opens as you pull, turns pages while refreshing.
 * Static markup: `useOverscroll` drives it through CSS variables (`.pull` in `shell.css`).
 */
export function PullIndicator() {
  return (
    <div aria-hidden className="pull">
      <span className="pull__book">
        <span className="pull__page pull__page--l" />
        <span className="pull__page pull__page--r" />
        <span className="pull__leaf" />
      </span>
    </div>
  );
}
