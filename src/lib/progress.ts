import { daysBetween, gain, pct, type Phase } from "./attempt";
import { NO_PROFESSOR, toCsv, type CsvOptions } from "./exports";
import { describe, groupBy, type Summary } from "./stats";

/**
 * Entry → exit pairing: the reason this whole project exists.
 *
 * Everything here is pure over plain rows, like `exports.ts`, so the arithmetic
 * that will end up in a faculty meeting is unit-testable without a database.
 *
 * ⚠️ Uses `pct`/`gain` from **`attempt.ts`**, not the `pct` in `stats.ts`. Two
 * exist: `stats.ts` keeps full precision for computing means, `attempt.ts` rounds
 * to one decimal for display and export. Gain is computed from the ROUNDED
 * percentages on purpose — an analyst who subtracts the two columns printed in
 * the CSV must get the third column back. A file whose own columns disagree with
 * each other gets distrusted entirely, and rightly.
 */

export interface AttemptScore {
  form: string;
  totalRaw: number | null;
  maxTotal: number | null;
  anchorRaw: number | null;
  maxAnchor: number | null;
  levelRaw: number | null;
  maxLevel: number | null;
  submittedAt: Date | null;
  durationMs: number | null;
}

export interface PairedInput {
  matricula: string;
  fullName: string;
  email: string;
  englishLevel: number;
  group: string;
  academicSemester: number;
  professorName: string | null;
  /** "AB" | "BA" — assigned once at enrollment. The counterbalancing itself. */
  formOrder: string;
  entry: AttemptScore | null;
  exit: AttemptScore | null;
}

/** Which of the two measurements a student actually has. */
export type PairState = "completo" | "solo entrada" | "solo salida" | "ninguno";

export interface PairedRow {
  matricula: string;
  nombre: string;
  correo: string;
  nivel: string;
  grupo: string;
  semestre: number | string;
  profesor: string;
  orden: string;
  formaEntrada: string;
  formaSalida: string;
  entradaPuntos: string;
  entradaPct: number | null;
  entradaFecha: string;
  salidaPuntos: string;
  salidaPct: number | null;
  salidaFecha: string;
  dias: number | null;
  avance: number | null;
  anclaEntradaPct: number | null;
  anclaSalidaPct: number | null;
  anclaAvance: number | null;
  estado: PairState;
}

const FECHA = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

function stateOf(entry: AttemptScore | null, exit: AttemptScore | null): PairState {
  if (entry && exit) return "completo";
  if (entry) return "solo entrada";
  if (exit) return "solo salida";
  return "ninguno";
}

function puntos(a: AttemptScore | null): string {
  return a && a.totalRaw !== null ? `${a.totalRaw}/${a.maxTotal}` : "";
}

/**
 * One row per student — WIDE format, which is what a paired t-test wants in
 * SPSS, R and Jamovi without reshaping. The long format (one row per attempt) is
 * what `/api/admin/asistencia` already gives, per window.
 */
export function pairedRows(students: PairedInput[]): PairedRow[] {
  return students
    .map((s) => {
      // ⚠️ Each attempt divides by its OWN stored max. `maxTotal` moved from 34
      // to 37 during development; if entry and exit ever sat on different
      // blueprints, percentages are the only honest way to subtract them — which
      // is exactly why gain is computed on percentages and not on raw points.
      const entradaPct = s.entry ? pct(s.entry.totalRaw, s.entry.maxTotal) : null;
      const salidaPct = s.exit ? pct(s.exit.totalRaw, s.exit.maxTotal) : null;
      const anclaEntradaPct = s.entry ? pct(s.entry.anchorRaw, s.entry.maxAnchor) : null;
      const anclaSalidaPct = s.exit ? pct(s.exit.anchorRaw, s.exit.maxAnchor) : null;

      return {
        matricula: s.matricula,
        nombre: s.fullName,
        correo: s.email,
        nivel: `Inglés ${s.englishLevel}`,
        grupo: s.group,
        semestre: s.academicSemester || "",
        profesor: s.professorName ?? NO_PROFESSOR,
        orden: s.formOrder,
        formaEntrada: s.entry?.form ?? "",
        formaSalida: s.exit?.form ?? "",
        entradaPuntos: puntos(s.entry),
        entradaPct,
        entradaFecha: s.entry?.submittedAt ? FECHA.format(s.entry.submittedAt) : "",
        salidaPuntos: puntos(s.exit),
        salidaPct,
        salidaFecha: s.exit?.submittedAt ? FECHA.format(s.exit.submittedAt) : "",
        dias: daysBetween(s.entry?.submittedAt ?? null, s.exit?.submittedAt ?? null),
        // ⚠️ Null unless BOTH exist. A student with only an entry score has an
        // UNKNOWN gain, not a gain of zero — and zero would sit in the mean
        // dragging it toward "no one learned anything".
        avance: gain(entradaPct, salidaPct),
        anclaEntradaPct,
        anclaSalidaPct,
        anclaAvance: gain(anclaEntradaPct, anclaSalidaPct),
        estado: stateOf(s.entry, s.exit),
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

export const PAIRED_COLUMNS = [
  { key: "matricula", header: "Matrícula" },
  { key: "nombre", header: "Nombre" },
  { key: "correo", header: "Correo" },
  { key: "nivel", header: "Nivel" },
  { key: "grupo", header: "Grupo" },
  { key: "semestre", header: "Semestre" },
  { key: "profesor", header: "Profesor" },
  { key: "orden", header: "Orden" },
  { key: "formaEntrada", header: "Forma entrada" },
  { key: "formaSalida", header: "Forma salida" },
  { key: "entradaPuntos", header: "Entrada puntos" },
  { key: "entradaPct", header: "Entrada %" },
  { key: "entradaFecha", header: "Entrada fecha" },
  { key: "salidaPuntos", header: "Salida puntos" },
  { key: "salidaPct", header: "Salida %" },
  { key: "salidaFecha", header: "Salida fecha" },
  { key: "dias", header: "Días" },
  { key: "avance", header: "Avance" },
  { key: "anclaEntradaPct", header: "Ancla entrada %" },
  { key: "anclaSalidaPct", header: "Ancla salida %" },
  { key: "anclaAvance", header: "Ancla avance" },
  { key: "estado", header: "Estado" },
];

export function pairedCsv(students: PairedInput[], options?: CsvOptions): string {
  return toCsv(
    PAIRED_COLUMNS,
    pairedRows(students) as unknown as Record<string, unknown>[],
    options,
  );
}

/** `Umbral_avance_Ago-Dic-2026.csv` */
export function pairedFilename(semesterLabel: string, professorName?: string | null): string {
  const slug = (s: string) =>
    s
      .normalize("NFD")
      .replace(/\p{M}+/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  const parts = ["Umbral", "avance", slug(semesterLabel)];
  if (professorName) parts.push(slug(professorName));
  return `${parts.join("_")}.csv`;
}

/* ------------------------------------------------------------------ *
 * Aggregates
 * ------------------------------------------------------------------ */

/** Rows where both measurements exist — the only ones a gain can be read from. */
export function pairedOnly(rows: PairedRow[]): PairedRow[] {
  return rows.filter((r) => r.avance !== null);
}

export interface DirectionCounts {
  subieron: number;
  iguales: number;
  bajaron: number;
}

/**
 * How many went up, stayed level, or went down.
 *
 * Worth showing beside the mean because a mean of +4 hides whether that is
 * everyone moving a little or a third of the cohort moving backwards, and the
 * second is the one that needs looking into.
 */
export function gainDirection(rows: PairedRow[]): DirectionCounts {
  const out: DirectionCounts = { subieron: 0, iguales: 0, bajaron: 0 };
  for (const r of rows) {
    if (r.avance === null) continue;
    if (r.avance > 0) out.subieron += 1;
    else if (r.avance < 0) out.bajaron += 1;
    else out.iguales += 1;
  }
  return out;
}

export interface GainGroup {
  key: string;
  entrada: Summary;
  salida: Summary;
  avance: Summary;
}

function summarize(key: string, rows: PairedRow[]): GainGroup {
  return {
    key,
    entrada: describe(rows.map((r) => r.entradaPct).filter((v): v is number => v !== null)),
    salida: describe(rows.map((r) => r.salidaPct).filter((v): v is number => v !== null)),
    avance: describe(rows.map((r) => r.avance).filter((v): v is number => v !== null)),
  };
}

/** Entry / exit / gain summaries, grouped by a derived key. Paired rows only. */
export function gainBy(rows: PairedRow[], key: (r: PairedRow) => string): GainGroup[] {
  const paired = pairedOnly(rows);
  return [...groupBy(paired, key).entries()]
    .map(([k, rs]) => summarize(k, rs))
    .sort((a, b) => a.key.localeCompare(b.key, "es"));
}

export interface FormEffect {
  ab: GainGroup;
  ba: GainGroup;
  /** Mean gain AB − mean gain BA. Null until both arms have someone in them. */
  gainDifference: number | null;
  /**
   * Mean ENTRY score AB − mean entry score BA.
   *
   * A different question from `gainDifference`, and it must be read first: at
   * entry the two arms have only been randomized, not taught, so a difference
   * here means the 50/50 assignment came out lopsided — a randomization problem,
   * not a form problem. Interpreting a gain difference without checking this
   * first is how a chance imbalance gets published as a finding.
   */
  entryDifference: number | null;
}

/**
 * THE validity check the instrument can run on itself.
 *
 * Half the students take A then B, half take B then A. If the two forms are
 * genuinely parallel, both arms should show the same mean gain — any real
 * difference between them is form difficulty leaking into the score, and it
 * would be pointing in opposite directions for the two halves of the cohort.
 *
 * This is why counterbalancing was chosen over per-student random sampling
 * (PLAN §2.1): random sampling puts every student on a different ruler and makes
 * this check impossible to even define.
 *
 * ⚠️ It reports a difference, not a verdict. With the cohort sizes here a few
 * points of difference is noise; the numbers are here to be looked at next to
 * their n and sd, not thresholded.
 */
export function formEffect(rows: PairedRow[]): FormEffect {
  const paired = pairedOnly(rows);
  const ab = summarize("AB", paired.filter((r) => r.orden === "AB"));
  const ba = summarize("BA", paired.filter((r) => r.orden === "BA"));

  const diff = (a: number | null, b: number | null) =>
    a === null || b === null ? null : Math.round((a - b) * 10) / 10;

  return {
    ab,
    ba,
    gainDifference: diff(ab.avance.mean, ba.avance.mean),
    entryDifference: diff(ab.entrada.mean, ba.entrada.mean),
  };
}

/** Coverage of the pairing itself — how much of the cohort a gain can be read for. */
export interface PairCoverage {
  total: number;
  completo: number;
  soloEntrada: number;
  soloSalida: number;
  ninguno: number;
}

export function pairCoverage(rows: PairedRow[]): PairCoverage {
  const out: PairCoverage = {
    total: rows.length,
    completo: 0,
    soloEntrada: 0,
    soloSalida: 0,
    ninguno: 0,
  };
  for (const r of rows) {
    if (r.estado === "completo") out.completo += 1;
    else if (r.estado === "solo entrada") out.soloEntrada += 1;
    else if (r.estado === "solo salida") out.soloSalida += 1;
    else out.ninguno += 1;
  }
  return out;
}

/** Label for a phase, in the interface's voice. */
export const phaseLabel = (phase: Phase) => (phase === "entry" ? "entrada" : "salida");
