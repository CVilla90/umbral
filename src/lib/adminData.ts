import { db } from "./db";
import {
  mergeRoster,
  NO_PROFESSOR,
  type AttendanceInput,
  type RosterStudent,
} from "./exports";

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
