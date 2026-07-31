/**
 * One timezone, stated out loud.
 *
 * WHY THIS EXISTS: window dates are instants in the database and calendar days
 * in Carlos's head, and the conversion between them must not depend on where the
 * code happens to be running. Locally the server is in Chihuahua; on Replit it is
 * UTC. `new Date("2026-08-10")` means a different instant in those two places, so
 * a window edited locally and read on the host would silently move by six hours —
 * and at a day boundary, by a whole day. That is the class of bug that opens a
 * window "on the 10th" and locks students out until the 11th.
 *
 * It also removes the React hydration hazard: server and browser both format
 * against a FIXED zone, so they always produce the same string.
 *
 * The whole faculty is in one city. Fixing the zone is not a simplification, it
 * is the actual requirement.
 */

export const ZONE = "America/Chihuahua";

const PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  // h23, not h12 and not the default: `hour12: false` can yield "24" for
  // midnight in some engines, which parses as the next day.
  hourCycle: "h23",
});

/** The wall clock this instant shows in Chihuahua, as `YYYY-MM-DDTHH:mm`. */
function wallClock(date: Date): string {
  const p = Object.fromEntries(
    PARTS.formatToParts(date).map((part) => [part.type, part.value]),
  ) as Record<string, string>;
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/** The calendar date this instant falls on in Chihuahua, as `YYYY-MM-DD`. */
export function zonedDate(date: Date): string {
  return wallClock(date).slice(0, 10);
}

/** Chihuahua's offset from UTC at a given instant, in milliseconds. */
function offsetMs(date: Date): number {
  const asIfUtc = Date.parse(`${wallClock(date)}:00Z`);
  // `wallClock` has minute resolution, so compare against the same resolution.
  return asIfUtc - Math.floor(date.getTime() / 60_000) * 60_000;
}

/**
 * A Chihuahua wall-clock time back into a real instant.
 *
 * Two passes: the first guesses the offset using the naive instant, the second
 * corrects it. One pass is wrong for any time within an offset's width of a DST
 * change — Chihuahua stopped observing DST in 2022, so this is defensive rather
 * than load-bearing today, but it costs one line and the alternative fails once
 * a year in a way nobody would connect to this file.
 */
function instantFrom(wall: string): Date | null {
  const naive = Date.parse(`${wall}Z`);
  if (Number.isNaN(naive)) return null;
  let ts = naive;
  for (let i = 0; i < 2; i++) ts = naive - offsetMs(new Date(ts));
  return new Date(ts);
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/**
 * `2026-08-10` → the instant that day BEGINS in Chihuahua.
 *
 * Windows are managed by the day, not the hour — "opens on the 10th" is the unit
 * Carlos actually thinks in, and an admin form asking for a time would invite a
 * typo that closes a window at 08:00 instead of the end of the day.
 */
export function startOfDay(isoDate: string): Date | null {
  return DATE_ONLY.test(isoDate) ? instantFrom(`${isoDate}T00:00:00`) : null;
}

/**
 * `2026-10-03` → the LAST instant of that day in Chihuahua.
 *
 * ⚠️ `closesAt` is inclusive (`now <= closesAt` in `windowIsOpen`), so it must be
 * the end of the closing day. Storing midnight instead would close the window a
 * full day early, and the students who lose out are exactly the ones who leave it
 * to the last day.
 */
export function endOfDay(isoDate: string): Date | null {
  const start = startOfDay(isoDate);
  return start ? new Date(start.getTime() + 86_400_000 - 1) : null;
}

const LONG = new Intl.DateTimeFormat("es-MX", {
  timeZone: ZONE,
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** "10 ago 2026" — for display, always in Chihuahua time. */
export function formatDate(date: Date): string {
  return LONG.format(date);
}
