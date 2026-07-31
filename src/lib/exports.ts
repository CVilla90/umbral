import type { Phase } from "./attempt";

/**
 * Downloadable exports for the admin dashboard.
 *
 * Pure functions over plain rows: the dashboard queries, these shape and
 * serialise. That keeps the CSV format unit-testable without a database, which
 * matters because a broken export is discovered by a professor opening a file,
 * not by a stack trace.
 */

/* ------------------------------------------------------------------ *
 * CSV
 * ------------------------------------------------------------------ */

/**
 * RFC 4180 escaping. A field is quoted if it contains the delimiter, a quote, or
 * a newline, and inner quotes are doubled.
 *
 * Not optional politeness: student names carry commas ("Pérez Gómez, Ana"), and
 * an unescaped one shifts every later column by a place — which produces a file
 * that opens fine and is silently wrong.
 */
function cell(value: unknown, delimiter: string): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  return s.includes(delimiter) || s.includes('"') || s.includes("\n") || s.includes("\r")
    ? `"${s.replace(/"/g, '""')}"`
    : s;
}

export interface CsvOptions {
  /** "," for R/SPSS/Python. Spanish Windows Excel expects ";" — see `bom`. */
  delimiter?: string;
  /**
   * UTF-8 byte-order mark, on by default.
   *
   * Without it, Excel on a Spanish Windows install reads the file as ANSI and
   * every accented name arrives mojibake — "Ramírez" becomes "RamÃ­rez". The BOM
   * is ignored by R, pandas and SPSS, so it costs nothing.
   */
  bom?: boolean;
}

export function toCsv(
  columns: { key: string; header: string }[],
  rows: Record<string, unknown>[],
  { delimiter = ",", bom = true }: CsvOptions = {},
): string {
  const head = columns.map((c) => cell(c.header, delimiter)).join(delimiter);
  const body = rows.map((row) =>
    columns.map((c) => cell(row[c.key], delimiter)).join(delimiter),
  );
  // CRLF: Excel is the primary consumer of the attendance list and is happiest
  // with it; every analysis tool accepts either.
  return (bom ? "﻿" : "") + [head, ...body].join("\r\n") + "\r\n";
}

/* ------------------------------------------------------------------ *
 * Attendance — "who participated", per professor
 * ------------------------------------------------------------------ */

export type Participation = "completa" | "incompleta" | "empezada" | "sin empezar";

export interface AttendanceInput {
  matricula: string;
  fullName: string;
  email: string;
  englishLevel: number;
  group: string;
  academicSemester: number;
  professorName: string | null;
  /** Null when the student enrolled but never opened this window's check-in. */
  attempt: {
    state: string;
    completed: boolean;
    submittedAt: Date | null;
    totalRaw: number | null;
    maxTotal: number | null;
  } | null;
  /** True when this student also appears in an uploaded roster for their group. */
  inRoster?: boolean;
  /** "roster" rows are people who never signed in — only knowable with a roster. */
  source?: "enrolled" | "roster";
}

/** A line from an uploaded class list. Optional, per group — see `mergeRoster`. */
export interface RosterStudent {
  matricula: string;
  fullName: string | null;
  englishLevel: number;
  group: string;
}

/**
 * Matrículas are typed by students on a phone and transcribed by staff into a
 * spreadsheet, so they arrive with stray spaces, hyphens and mixed case. Fold all
 * of that before matching.
 *
 * Known limit: this cannot reconcile a genuine prefix difference (`349021` vs
 * `A349021`). Those surface as "participated but not in roster", which is a
 * data-quality signal worth seeing rather than something to paper over silently.
 */
export function normalizeMatricula(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** A group is roster-backed when at least one roster line exists for it. */
export function groupKey(englishLevel: number, group: string): string {
  return `${englishLevel}|${group.toUpperCase()}`;
}

export function rosteredGroups(roster: RosterStudent[]): Set<string> {
  return new Set(roster.map((r) => groupKey(r.englishLevel, r.group)));
}

/**
 * Combine who enrolled with who was *supposed* to be there.
 *
 * Rosters are **optional and per group** (Carlos, 2026-07-30): he can upload his
 * own groups easily, other professors' groups not at all. So coverage is expected
 * to be partial forever, and the merge has to stay honest about which is which:
 *
 *  - **Roster-backed group** → students who never signed in appear as
 *    `sin empezar`, and the group has a real denominator.
 *  - **Group with no roster** → only the students Umbral has actually seen. The
 *    list is "who did", never "who didn't", and the denominator is unknown.
 *
 * The second case is the normal one, and it is genuinely useful on its own: a
 * professor handed a list of the 23 students who participated can work out the
 * rest from their own class list.
 */
export function mergeRoster(
  enrolled: AttendanceInput[],
  roster: RosterStudent[],
  professorFor: (englishLevel: number, group: string) => string | null = () => null,
): AttendanceInput[] {
  const covered = rosteredGroups(roster);
  const seen = new Set(enrolled.map((e) => normalizeMatricula(e.matricula)));

  const marked: AttendanceInput[] = enrolled.map((e) => ({
    ...e,
    source: "enrolled",
    // Only meaningful where a roster exists; elsewhere it is not "missing from
    // the roster", it is "there is no roster".
    inRoster: covered.has(groupKey(e.englishLevel, e.group))
      ? roster.some((r) => normalizeMatricula(r.matricula) === normalizeMatricula(e.matricula))
      : undefined,
  }));

  const missing: AttendanceInput[] = roster
    .filter((r) => !seen.has(normalizeMatricula(r.matricula)))
    .map((r) => ({
      matricula: r.matricula,
      fullName: r.fullName ?? "",
      email: "",
      englishLevel: r.englishLevel,
      group: r.group,
      academicSemester: 0,
      professorName: professorFor(r.englishLevel, r.group),
      attempt: null,
      inRoster: true,
      source: "roster",
    }));

  return [...marked, ...missing];
}

export interface AttendanceRow {
  matricula: string;
  nombre: string;
  correo: string;
  nivel: string;
  grupo: string;
  semestre: number | string;
  profesor: string;
  participacion: Participation;
  fecha: string;
  puntos: string;
  porcentaje: string;
  /** "sí" / "no" / "" — empty when the group has no roster to compare against. */
  enLista: string;
}

/** Unmapped groups are labelled, never blank — a blank column reads as a bug. */
export const NO_PROFESSOR = "sin asignar";

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

/**
 * Four states, not two.
 *
 * "Participated / did not" throws away the distinction a professor most needs:
 * a student who opened the check-in and stalled needs a nudge, while one who
 * finished needs nothing. `empezada` is that nudge list.
 */
export function participationOf(attempt: AttendanceInput["attempt"]): Participation {
  if (!attempt) return "sin empezar";
  if (attempt.state === "in_progress") return "empezada";
  return attempt.completed ? "completa" : "incompleta";
}

export function attendanceRows(students: AttendanceInput[]): AttendanceRow[] {
  return students
    .map((s) => {
      const participacion = participationOf(s.attempt);
      const pct =
        s.attempt && s.attempt.totalRaw !== null && s.attempt.maxTotal
          ? Math.round((s.attempt.totalRaw / s.attempt.maxTotal) * 1000) / 10
          : null;

      return {
        matricula: s.matricula,
        nombre: s.fullName,
        correo: s.email,
        nivel: `Inglés ${s.englishLevel}`,
        grupo: s.group,
        // A roster line carries no academic semester — the student never told us.
        // Blank is honest; 0 would look like a real value.
        semestre: s.academicSemester || "",
        profesor: s.professorName ?? NO_PROFESSOR,
        participacion,
        fecha: s.attempt?.submittedAt ? FECHA.format(s.attempt.submittedAt) : "",
        puntos:
          s.attempt && s.attempt.totalRaw !== null
            ? `${s.attempt.totalRaw}/${s.attempt.maxTotal}`
            : "",
        porcentaje: pct === null ? "" : String(pct),
        enLista: s.inRoster === undefined ? "" : s.inRoster ? "sí" : "no",
      };
    })
    .sort(
      (a, b) =>
        a.profesor.localeCompare(b.profesor, "es") ||
        a.nivel.localeCompare(b.nivel, "es") ||
        a.grupo.localeCompare(b.grupo, "es") ||
        a.nombre.localeCompare(b.nombre, "es"),
    );
}

export const ATTENDANCE_COLUMNS = [
  { key: "matricula", header: "Matrícula" },
  { key: "nombre", header: "Nombre" },
  { key: "correo", header: "Correo" },
  { key: "nivel", header: "Nivel" },
  { key: "grupo", header: "Grupo" },
  { key: "semestre", header: "Semestre" },
  { key: "profesor", header: "Profesor" },
  { key: "participacion", header: "Participación" },
  { key: "fecha", header: "Fecha" },
  { key: "puntos", header: "Puntos" },
  { key: "porcentaje", header: "Porcentaje" },
  { key: "enLista", header: "En lista" },
];

export function attendanceCsv(students: AttendanceInput[], options?: CsvOptions): string {
  return toCsv(
    ATTENDANCE_COLUMNS,
    attendanceRows(students) as unknown as Record<string, unknown>[],
    options,
  );
}

/** `Umbral_asistencia_entrada_Ago-Dic-2026_Ramirez.csv` */
export function attendanceFilename(
  phase: Phase,
  semesterLabel: string,
  professorName?: string | null,
): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const parts = ["Umbral", "asistencia", phase === "entry" ? "entrada" : "salida", slug(semesterLabel)];
  if (professorName) parts.push(slug(professorName));
  return `${parts.join("_")}.csv`;
}

/**
 * Per-professor counts for the dashboard's summary above the download button.
 *
 * ⚠️ `pct` is **null** for a professor whose groups have no roster, and that is
 * the whole point of this function. Umbral only sees a student once they have
 * signed in, so without a roster the denominator is unknown — and dividing by the
 * count of people who showed up would report every unrostered group at 100 %,
 * sitting in the same table as a rostered group at 58 %. That comparison would be
 * fiction, and it would be read as fact.
 *
 * `rostered` is exported alongside so the UI can say "23 participaron (lista no
 * cargada)" instead of a percentage.
 */
export interface ProfessorSummary {
  profesor: string;
  completa: number;
  incompleta: number;
  empezada: number;
  "sin empezar": number;
  total: number;
  participaron: number;
  /** Null when no roster covers this professor's groups. Never fabricate it. */
  pct: number | null;
  rostered: boolean;
}

export function attendanceSummary(rows: AttendanceRow[]): ProfessorSummary[] {
  const by = new Map<
    string,
    Record<Participation, number> & { total: number; rostered: boolean }
  >();

  for (const row of rows) {
    const cur =
      by.get(row.profesor) ??
      { completa: 0, incompleta: 0, empezada: 0, "sin empezar": 0, total: 0, rostered: false };
    cur[row.participacion] += 1;
    cur.total += 1;
    // "En lista" is only filled in where a roster exists for that group.
    if (row.enLista !== "") cur.rostered = true;
    by.set(row.profesor, cur);
  }

  return [...by.entries()]
    .map(([profesor, c]) => {
      const participaron = c.completa + c.incompleta;
      return {
        profesor,
        completa: c.completa,
        incompleta: c.incompleta,
        empezada: c.empezada,
        "sin empezar": c["sin empezar"],
        total: c.total,
        participaron,
        pct: c.rostered && c.total ? Math.round((participaron / c.total) * 1000) / 10 : null,
        rostered: c.rostered,
      };
    })
    .sort((a, b) => a.profesor.localeCompare(b.profesor, "es"));
}
