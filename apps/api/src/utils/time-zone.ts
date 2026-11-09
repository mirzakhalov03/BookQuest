const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function wallClock(date: Date, timeZone: string): Record<string, number> {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
    partsFormatters.set(timeZone, formatter);
  }
  return Object.fromEntries(
    formatter.formatToParts(date).flatMap((part) => (part.type === 'literal' ? [] : [[part.type, Number(part.value)]]))
  );
}

// How far the zone's wall clock is ahead of UTC at that instant.
function offsetMs(date: Date, timeZone: string): number {
  const p = wallClock(date, timeZone);
  return Date.UTC(p.year!, p.month! - 1, p.day!, p.hour!, p.minute!, p.second!) - Math.floor(date.getTime() / 1000) * 1000;
}

/** Midnight of `now`'s calendar day in `timeZone`, as a UTC instant. No library: Intl already knows the zones. */
export function startOfDayIn(timeZone: string, now = new Date()): Date {
  const p = wallClock(now, timeZone);
  const midnightAsUtc = Date.UTC(p.year!, p.month! - 1, p.day!);
  return new Date(midnightAsUtc - offsetMs(new Date(midnightAsUtc), timeZone));
}
