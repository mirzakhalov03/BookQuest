/** The cone, the pool it casts, and the ring at the edge of the lit floor. Purely decorative. */
export function Spotlight() {
  return (
    <div className="spotlight" aria-hidden="true">
      <div className="spotlight__cone" />
      <div className="spotlight__pool" />
      <div className="spotlight__ring" />
    </div>
  );
}
