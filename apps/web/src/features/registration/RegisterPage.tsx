/**
 * Stub. The finished composition lives in /prototype/index.html — the title
 * page layout, ruled fields and participant-number reveal are ported here.
 *
 * The validation rules are already shared: import { parseFullName } from
 * '@bookquest/shared' and the browser and the API agree by construction.
 */
export function RegisterPage() {
  return (
    <div className="flex flex-1 flex-col justify-center gap-6 p-6">
      <p className="type-label">Fourth annual reading competition</p>
      <h1 className="type-display text-6xl">
        Enter
        <br />
        the quest
      </h1>
      <p className="max-w-[34ch] text-paper-dim">
        One book, one deadline, one quiz. Read before the clock runs out, then answer faster and
        better than everyone else.
      </p>
    </div>
  );
}
