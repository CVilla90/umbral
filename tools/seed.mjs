/**
 * Seeds the semester and its two windows.
 *
 *   npm run db:seed
 *
 * Idempotent: re-running updates the existing rows rather than duplicating them,
 * so it is safe to run against a database that already has students in it. It
 * never touches enrollments, attempts or responses.
 *
 * Professors are deliberately NOT seeded. The group -> professor mapping is the
 * authoritative source for the per-professor metric (PLAN §6.2) and it is real
 * institutional data that only Carlos has; inventing placeholder names here would
 * put fake professors in front of students on day one.
 */
import { PrismaClient } from "@prisma/client";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

// Read the calendar from the same TS module the landing page uses, so the seeded
// windows and the dates advertised on the tape can never disagree.
const calendarSrc = readFileSync(join(here, "..", "src", "lib", "calendar.ts"), "utf8");
function field(name) {
  const m = calendarSrc.match(new RegExp(`${name}:\\s*"([^"]+)"`));
  if (!m) throw new Error(`calendar.ts is missing ${name}`);
  return m[1];
}

const SPEC = {
  label: field("label"),
  startsOn: field("startsOn"),
  endsOn: field("endsOn"),
  entryOpensAt: field("entryOpensAt"),
  entryClosesAt: field("entryClosesAt"),
  exitOpensAt: field("exitOpensAt"),
  exitClosesAt: field("exitClosesAt"),
};

// A window closes at the END of its last day, not at midnight on its first
// moment. Getting this wrong silently costs the instrument every student who
// tries on the final afternoon.
const startOfDay = (iso) => new Date(`${iso}T00:00:00.000Z`);
const endOfDay = (iso) => new Date(`${iso}T23:59:59.999Z`);

const db = new PrismaClient();

try {
  const semester = await db.semester.upsert({
    where: { label: SPEC.label },
    update: {
      startsOn: startOfDay(SPEC.startsOn),
      endsOn: startOfDay(SPEC.endsOn),
      isActive: true,
    },
    create: {
      label: SPEC.label,
      startsOn: startOfDay(SPEC.startsOn),
      endsOn: startOfDay(SPEC.endsOn),
      isActive: true,
    },
  });

  // Exactly one active semester, always. Two would make "which window am I in?"
  // ambiguous and quietly split a cohort across instruments.
  await db.semester.updateMany({
    where: { id: { not: semester.id } },
    data: { isActive: false },
  });

  const windows = [
    {
      phase: "entry",
      opensAt: startOfDay(SPEC.entryOpensAt),
      closesAt: endOfDay(SPEC.entryClosesAt),
    },
    {
      phase: "exit",
      opensAt: startOfDay(SPEC.exitOpensAt),
      closesAt: endOfDay(SPEC.exitClosesAt),
    },
  ];

  for (const w of windows) {
    await db.window.upsert({
      where: { semesterId_phase: { semesterId: semester.id, phase: w.phase } },
      update: { opensAt: w.opensAt, closesAt: w.closesAt },
      // "open" not "draft": the dates already gate access, and a window that is
      // scheduled but forgotten in draft is a silent outage on day one.
      create: { ...w, semesterId: semester.id, status: "open" },
    });
  }

  console.log(`\n  Semestre: ${semester.label}  (${SPEC.startsOn} -> ${SPEC.endsOn})`);
  console.log(`  Entrada:  ${SPEC.entryOpensAt} -> ${SPEC.entryClosesAt}`);
  console.log(`  Salida:   ${SPEC.exitOpensAt} -> ${SPEC.exitClosesAt}`);
  console.log(`\n  Profesores: ninguno. Agrégalos desde el panel de administración.\n`);
} finally {
  await db.$disconnect();
}
