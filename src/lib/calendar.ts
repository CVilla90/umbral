/**
 * The semester calendar, in one place.
 *
 * This is shared by the DB seed and by the hero tape on the landing page, which
 * is the point: the tape is not a decoration that happens to look like a
 * timeline, it *is* the semester, so a date change moves both together and the
 * page can never advertise a window that isn't open.
 *
 * Once a semester exists in the database the admin owns its dates (PLAN §4.1) and
 * these values are only the seed + the marketing surface.
 */

export interface SemesterSpec {
  label: string;
  startsOn: string; // ISO date, first day of classes
  endsOn: string; // ISO date, last day of classes
  entryOpensAt: string;
  entryClosesAt: string;
  exitOpensAt: string;
  exitClosesAt: string;
}

/**
 * Ago–Dic 2026. Windows split at the semester midpoint, which is Carlos's call
 * (2026-07-30).
 *
 * Recorded dissent, PLAN §4.1: an "entry" score collected in week 8 is not a
 * baseline, it is contaminated by the instruction it is meant to precede. The
 * recommendation was to close entry around 2026-08-31. The dates are
 * admin-editable, so this is one field to change if week-1 uptake shows a long
 * tail of late entries.
 */
export const CURRENT_SEMESTER: SemesterSpec = {
  label: "Ago-Dic 2026",
  startsOn: "2026-08-10",
  endsOn: "2026-11-27",
  entryOpensAt: "2026-08-10",
  entryClosesAt: "2026-10-03",
  exitOpensAt: "2026-10-04",
  exitClosesAt: "2026-11-27",
};

const DAY_MS = 86_400_000;

function utc(iso: string): number {
  return Date.parse(`${iso}T00:00:00Z`);
}

/** Whole days spanned by the semester. */
export function semesterDays(s: SemesterSpec = CURRENT_SEMESTER): number {
  return Math.round((utc(s.endsOn) - utc(s.startsOn)) / DAY_MS);
}

/** Where an ISO date falls along the semester, 0–100. Clamped at both ends. */
export function pctOfSemester(iso: string, s: SemesterSpec = CURRENT_SEMESTER): number {
  const total = utc(s.endsOn) - utc(s.startsOn);
  if (total <= 0) return 0;
  const at = (utc(iso) - utc(s.startsOn)) / total;
  return Math.min(100, Math.max(0, at * 100));
}

/** First-of-month gridlines that fall inside the semester, for the tape's labels. */
export function monthTicks(
  s: SemesterSpec = CURRENT_SEMESTER,
): { label: string; pct: number }[] {
  const names = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  const start = new Date(utc(s.startsOn));
  const end = new Date(utc(s.endsOn));
  const out: { label: string; pct: number }[] = [];

  // The month the semester opens in is labelled at the very start of the tape,
  // because its 1st falls before day zero.
  out.push({ label: names[start.getUTCMonth()], pct: 0 });

  const cursor = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
  while (cursor <= end) {
    const iso = cursor.toISOString().slice(0, 10);
    out.push({ label: names[cursor.getUTCMonth()], pct: pctOfSemester(iso, s) });
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

/** Weekly minor ticks across the tape, as percentages. */
export function weekTicks(s: SemesterSpec = CURRENT_SEMESTER): number[] {
  const weeks = Math.floor(semesterDays(s) / 7);
  return Array.from({ length: weeks + 1 }, (_, i) => (i / weeks) * 100);
}

const MONTHS_ES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/** "10 de agosto" — for prose, where a bare ISO date reads as machinery. */
export function longDate(iso: string): string {
  const d = new Date(utc(iso));
  return `${d.getUTCDate()} de ${MONTHS_ES[d.getUTCMonth()]}`;
}
