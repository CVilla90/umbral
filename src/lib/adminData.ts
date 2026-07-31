import { db } from "./db";
import {
  mergeRoster,
  normalizeMatricula,
  NO_PROFESSOR,
  type AttendanceInput,
  type RosterStudent,
} from "./exports";
import type { ItemResponseRow } from "./items";
import type { AttemptScore, PairedInput } from "./progress";
import { pct } from "./stats";

export interface WindowRef {
  id: string;
  phase: string;
  opensAt: Date;
  closesAt: Date;
  status: string;
}

export interface SemesterContext {
  id: string;
  label: string;
  windows: WindowRef[];
}

/** The active semester and its windows, or null before one is seeded. */
export async function activeSemester(): Promise<SemesterContext | null> {
  const semester = await db().semester.findFirst({
    where: { isActive: true },
    include: { windows: { orderBy: { opensAt: "asc" } } },
  });
  if (!semester) return null;
  return {
    id: semester.id,
    label: semester.label,
    windows: semester.windows.map((w) => ({
      id: w.id,
      phase: w.phase,
      opensAt: w.opensAt,
      closesAt: w.closesAt,
      status: w.status,
    })),
  };
}

/**
 * Everyone who should appear in one window's attendance list.
 *
 * Two sources, deliberately merged rather than joined: **enrollments** are who
 * Umbral has actually seen, and the optional **roster** is who was supposed to be
 * there. Only the second can produce a `sin empezar` row, which is why rosters
 * matter at all — and why `mergeRoster` marks group-by-group which is which
 * instead of assuming full coverage (see `exports.ts` and PLAN §9).
 *
 * The attempt is fetched per enrollment for THIS window only. Fetching all
 * attempts and filtering in JS would quietly let an entry attempt satisfy an exit
 * row, which is the one mistake that would make the gain score meaningless.
 */
export async function attendanceFor(
  semesterId: string,
  windowId: string,
): Promise<AttendanceInput[]> {
  const enrollments = await db().enrollment.findMany({
    where: { semesterId },
    include: {
      user: { select: { email: true } },
      professor: { select: { name: true } },
      attempts: {
        where: { windowId },
        select: {
          state: true,
          completed: true,
          submittedAt: true,
          totalRaw: true,
          maxTotal: true,
        },
      },
    },
    orderBy: [{ englishLevel: "asc" }, { group: "asc" }, { fullName: "asc" }],
  });

  const enrolled: AttendanceInput[] = enrollments.map((e) => ({
    matricula: e.matricula,
    fullName: e.fullName,
    email: e.user.email,
    englishLevel: e.englishLevel,
    group: e.group,
    academicSemester: e.academicSemester,
    professorName: e.professor?.name ?? null,
    // `@@unique([enrollmentId, windowId])` guarantees at most one.
    attempt: e.attempts[0] ?? null,
  }));

  const roster = await db().rosterEntry.findMany({ where: { semesterId } });
  const rosterStudents: RosterStudent[] = roster.map((r) => ({
    matricula: r.matricula,
    fullName: r.fullName,
    englishLevel: r.englishLevel,
    group: r.group,
  }));

  // A roster line names a student, never a professor, so a `sin empezar` row can
  // only be attributed through the group→professor mapping. Where that mapping
  // is missing the row is labelled, not blanked — see NO_PROFESSOR.
  const assignments = await db().groupAssignment.findMany({
    where: { semesterId },
    include: { professor: { select: { name: true } } },
  });
  const professorByGroup = new Map(
    assignments.map((a) => [`${a.englishLevel}|${a.group.toUpperCase()}`, a.professor.name]),
  );

  return mergeRoster(
    enrolled,
    rosterStudents,
    (level, group) => professorByGroup.get(`${level}|${group.toUpperCase()}`) ?? NO_PROFESSOR,
  );
}

export interface ScoredAttempt {
  englishLevel: number;
  group: string;
  form: string;
  professorName: string;
  anchorPct: number | null;
  levelPct: number | null;
  totalPct: number | null;
  durationMin: number | null;
}

/**
 * Scored attempts for one window.
 *
 * ⚠️ **Only `submitted`/`auto_submitted` attempts.** An in-progress attempt has
 * null totals and is not a measurement yet; including it would drag every mean
 * down by however many students happen to have the tab open.
 *
 * ⚠️ Every percentage divides by the attempt's OWN stored max, never a constant
 * — `maxTotal` moved from 34 to 37 during development, and attempts taken under
 * the old blueprint must keep their own denominator.
 */
export async function scoresFor(
  semesterId: string,
  windowId: string,
): Promise<ScoredAttempt[]> {
  const attempts = await db().attempt.findMany({
    where: {
      windowId,
      state: { in: ["submitted", "auto_submitted"] },
      enrollment: { semesterId },
    },
    select: {
      englishLevel: true,
      form: true,
      anchorRaw: true,
      levelRaw: true,
      totalRaw: true,
      maxAnchor: true,
      maxLevel: true,
      maxTotal: true,
      durationMs: true,
      enrollment: {
        select: { group: true, professor: { select: { name: true } } },
      },
    },
  });

  return attempts.map((a) => ({
    englishLevel: a.englishLevel,
    group: a.enrollment.group,
    form: a.form,
    professorName: a.enrollment.professor?.name ?? NO_PROFESSOR,
    anchorPct: pct(a.anchorRaw, a.maxAnchor),
    levelPct: pct(a.levelRaw, a.maxLevel),
    totalPct: pct(a.totalRaw, a.maxTotal),
    durationMin: a.durationMs === null ? null : a.durationMs / 60000,
  }));
}

export interface SemesterPoint {
  semesterId: string;
  label: string;
  phase: string;
  n: number;
  /** Mean anchor percentage. ⚠️ The ONLY figure comparable across semesters. */
  anchorMean: number | null;
  totalMean: number | null;
}

/**
 * One point per semester × phase — the longitudinal series.
 *
 * ⚠️ **Only the anchor mean may be compared across semesters.** The anchor is the
 * same eight items for every level and every cohort, which is exactly what makes
 * it a fixed ruler (PLAN §2.2). The total is not: it is level-specific, so a
 * semester with more Inglés 4 students shows a different total for reasons that
 * have nothing to do with anybody learning anything.
 *
 * Returns every semester, not just the active one — that is the whole point.
 */
export async function semesterSeries(): Promise<SemesterPoint[]> {
  const semesters = await db().semester.findMany({
    include: { windows: { orderBy: { opensAt: "asc" } } },
    orderBy: { startsOn: "asc" },
  });

  const points: SemesterPoint[] = [];
  for (const semester of semesters) {
    for (const window of semester.windows) {
      const attempts = await db().attempt.findMany({
        where: {
          windowId: window.id,
          state: { in: ["submitted", "auto_submitted"] },
        },
        select: { anchorRaw: true, maxAnchor: true, totalRaw: true, maxTotal: true },
      });

      const mean = (values: (number | null)[]) => {
        const xs = values.filter((v): v is number => v !== null);
        return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
      };

      points.push({
        semesterId: semester.id,
        label: semester.label,
        phase: window.phase,
        n: attempts.length,
        anchorMean: mean(attempts.map((a) => pct(a.anchorRaw, a.maxAnchor))),
        totalMean: mean(attempts.map((a) => pct(a.totalRaw, a.maxTotal))),
      });
    }
  }
  return points;
}

/**
 * Students measured in more than one semester.
 *
 * The longest arc this instrument can draw: someone who takes Inglés 1 in August
 * and Inglés 2 the following spring has four measurements on one anchor scale.
 *
 * ⚠️ Empty by construction until a second semester exists — matching is on
 * `matricula`, which is unique PER SEMESTER by design (a student legitimately
 * reappears in a different group next term).
 */
export async function returningStudents(): Promise<
  { matricula: string; fullName: string; semesters: string[] }[]
> {
  const enrollments = await db().enrollment.findMany({
    select: {
      matricula: true,
      fullName: true,
      semester: { select: { label: true, startsOn: true } },
    },
    orderBy: { semester: { startsOn: "asc" } },
  });

  const by = new Map<string, { matricula: string; fullName: string; semesters: string[] }>();
  for (const e of enrollments) {
    const key = normalizeMatricula(e.matricula);
    const found = by.get(key);
    if (found) {
      if (!found.semesters.includes(e.semester.label)) found.semesters.push(e.semester.label);
    } else {
      by.set(key, {
        matricula: e.matricula,
        fullName: e.fullName,
        semesters: [e.semester.label],
      });
    }
  }

  return [...by.values()]
    .filter((s) => s.semesters.length > 1)
    .sort((a, b) => a.fullName.localeCompare(b.fullName, "es"));
}

/**
 * Every graded response in one window, with its attempt's total attached.
 *
 * The total travels on each row because discrimination needs it, and joining it
 * back in the analysis layer would drag the database into a file that is pure on
 * purpose.
 *
 * ⚠️ Submitted attempts only, same as everywhere else. A half-finished attempt's
 * total is not a total, and correlating against it would corrupt every
 * discrimination figure on the page.
 */
export async function responsesFor(
  semesterId: string,
  windowId: string,
  englishLevel?: number,
): Promise<ItemResponseRow[]> {
  const attempts = await db().attempt.findMany({
    where: {
      windowId,
      state: { in: ["submitted", "auto_submitted"] },
      enrollment: { semesterId },
      ...(englishLevel ? { englishLevel } : {}),
    },
    select: {
      totalRaw: true,
      responses: {
        select: {
          itemId: true,
          block: true,
          type: true,
          raw: true,
          points: true,
          maxPoints: true,
          msElapsed: true,
          skipped: true,
        },
      },
    },
  });

  return attempts.flatMap((a) =>
    a.responses.map((r) => ({
      itemId: r.itemId,
      block: r.block,
      type: r.type,
      raw: r.raw,
      points: r.points,
      maxPoints: r.maxPoints,
      msElapsed: r.msElapsed,
      skipped: r.skipped,
      attemptTotal: a.totalRaw ?? 0,
    })),
  );
}

/**
 * Every enrollment with both of its attempts side by side — the input to the
 * gain page and the paired export.
 *
 * ⚠️ Rosters are deliberately NOT merged in here, unlike `attendanceFor`. A
 * roster line is a name with no attempt on either side, so it could only ever
 * produce a `ninguno` row: it would inflate the denominator of the pairing
 * coverage without ever contributing a gain. Who never showed up is the
 * attendance page's question, and it answers it better.
 *
 * ⚠️ Attempts are matched to windows BY ID, not by taking the first two. An
 * entry attempt satisfying an exit slot is the single mistake that would make
 * every gain score in the file silently wrong.
 */
export async function pairsFor(semesterId: string): Promise<PairedInput[]> {
  const semester = await db().semester.findUnique({
    where: { id: semesterId },
    include: { windows: true },
  });
  if (!semester) return [];

  const entryId = semester.windows.find((w) => w.phase === "entry")?.id ?? null;
  const exitId = semester.windows.find((w) => w.phase === "exit")?.id ?? null;

  const enrollments = await db().enrollment.findMany({
    where: { semesterId },
    include: {
      user: { select: { email: true } },
      professor: { select: { name: true } },
      attempts: {
        // Same rule as `scoresFor`: an in-progress attempt is not a measurement.
        where: { state: { in: ["submitted", "auto_submitted"] } },
        select: {
          windowId: true,
          form: true,
          totalRaw: true,
          maxTotal: true,
          anchorRaw: true,
          maxAnchor: true,
          levelRaw: true,
          maxLevel: true,
          submittedAt: true,
          durationMs: true,
        },
      },
    },
    orderBy: [{ englishLevel: "asc" }, { group: "asc" }, { fullName: "asc" }],
  });

  const score = (
    rows: { windowId: string }[],
    windowId: string | null,
  ): AttemptScore | null => {
    if (!windowId) return null;
    const found = rows.find((r) => r.windowId === windowId);
    return (found as AttemptScore & { windowId: string }) ?? null;
  };

  return enrollments.map((e) => ({
    matricula: e.matricula,
    fullName: e.fullName,
    email: e.user.email,
    englishLevel: e.englishLevel,
    group: e.group,
    academicSemester: e.academicSemester,
    professorName: e.professor?.name ?? null,
    formOrder: e.formOrder,
    entry: score(e.attempts, entryId),
    exit: score(e.attempts, exitId),
  }));
}
