"use server";

import { revalidatePath } from "next/cache";
import { audit, isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { endOfDay, startOfDay } from "@/lib/zone";

/**
 * Everything on the manage page edits ROWS THAT ALREADY EXIST.
 *
 * That is the design constraint, not an accident: window dates, professors and
 * group→professor mappings are all data, so next semester's changes are typing,
 * never a deploy. Nothing here creates a schema or a code path that has to be
 * revisited in January.
 */

export interface ManageState {
  status: "idle" | "ok" | "error" | "confirm";
  message?: string;
  /** Echoed back so the reopen flow can show what it is about to touch. */
  attemptId?: string;
  detail?: string;
}

const OK = (message: string): ManageState => ({ status: "ok", message });
const FAIL = (message: string): ManageState => ({ status: "error", message });

async function guard(): Promise<ManageState | null> {
  return (await isAdminRequest()) ? null : FAIL("No autorizado.");
}

function refresh() {
  revalidatePath("/admin/administrar");
  revalidatePath("/admin");
}

/* ------------------------------------------------------------------ *
 * Windows
 * ------------------------------------------------------------------ */

const STATUSES = ["draft", "open", "paused", "closed"] as const;

/**
 * Dates and status, saved together but independent (PLAN §4.1).
 *
 * ⚠️ Status is deliberately NOT derived from the dates. "Pause right now" must
 * not destroy the schedule it is pausing, and re-opening must not mean retyping
 * two dates. `windowIsOpen` requires both to agree.
 *
 * ⚠️ Dates arrive as calendar days and are anchored in Chihuahua time — see
 * `lib/zone.ts`. The closing day is stored at its LAST instant, because
 * `closesAt` is inclusive.
 */
export async function saveWindow(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const denied = await guard();
  if (denied) return denied;

  const id = String(formData.get("windowId") ?? "");
  const status = String(formData.get("status") ?? "");
  const opens = String(formData.get("opensOn") ?? "");
  const closes = String(formData.get("closesOn") ?? "");

  if (!STATUSES.includes(status as (typeof STATUSES)[number])) {
    return FAIL("Estado desconocido.");
  }

  const opensAt = startOfDay(opens);
  const closesAt = endOfDay(closes);
  if (!opensAt || !closesAt) return FAIL("Las fechas no se entendieron.");
  if (closesAt <= opensAt) return FAIL("La fecha de cierre va después de la de apertura.");

  const window = await db().window.findUnique({ where: { id } });
  if (!window) return FAIL("Esa ventana ya no existe.");

  await db().window.update({ where: { id }, data: { status, opensAt, closesAt } });
  await audit("window.save", {
    type: "Window",
    id,
    payload: {
      de: { status: window.status, opensAt: window.opensAt, closesAt: window.closesAt },
      a: { status, opensAt, closesAt },
    },
  });

  refresh();
  return OK(`Ventana de ${window.phase === "entry" ? "entrada" : "salida"} actualizada.`);
}

/* ------------------------------------------------------------------ *
 * Professors
 * ------------------------------------------------------------------ */

export async function addProfessor(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const denied = await guard();
  if (denied) return denied;

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase() || null;
  if (!name) return FAIL("Escribe el nombre.");

  // The whole reason Professor is a table and not a string column: free text
  // yields six spellings of one person, and then six rows in every report.
  const existing = await db().professor.findFirst({
    where: { name: { equals: name, mode: "insensitive" } },
  });
  if (existing) {
    return FAIL(`Ya existe "${existing.name}". Usa ese, o cámbiale el nombre a este.`);
  }

  const created = await db().professor.create({ data: { name, email } });
  await audit("professor.add", { type: "Professor", id: created.id, payload: { name, email } });

  refresh();
  return OK(`Agregado ${name}.`);
}

/**
 * Deactivate, never delete.
 *
 * A professor row is referenced by enrollments that are already scored. Deleting
 * one would either fail on the foreign key or orphan a semester's results;
 * `isActive` keeps last semester's reports readable while removing them from
 * this semester's pickers.
 */
export async function toggleProfessor(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const denied = await guard();
  if (denied) return denied;

  const id = String(formData.get("professorId") ?? "");
  const professor = await db().professor.findUnique({ where: { id } });
  if (!professor) return FAIL("Ese profesor ya no existe.");

  await db().professor.update({ where: { id }, data: { isActive: !professor.isActive } });
  await audit("professor.toggle", {
    type: "Professor",
    id,
    payload: { isActive: !professor.isActive },
  });

  refresh();
  return OK(`${professor.name}: ${professor.isActive ? "desactivado" : "reactivado"}.`);
}

/* ------------------------------------------------------------------ *
 * Group → professor
 * ------------------------------------------------------------------ */

/**
 * The authoritative mapping, and the reason `sin asignar` can disappear from a
 * report retroactively.
 *
 * ⚠️ Saving a mapping also RE-RESOLVES the enrollments already in that group.
 * Students enrol before Carlos has finished filling the table in, and without
 * this their rows would stay unattributed for the rest of the semester even
 * after the mapping exists. `professorRaw` — what the student typed — is left
 * untouched, so the cross-check survives.
 */
export async function saveAssignment(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const denied = await guard();
  if (denied) return denied;

  const semesterId = String(formData.get("semesterId") ?? "");
  const professorId = String(formData.get("professorId") ?? "");
  const englishLevel = Number(formData.get("englishLevel"));
  const group = String(formData.get("group") ?? "").trim().toUpperCase();

  if (![1, 2, 3, 4].includes(englishLevel)) return FAIL("Nivel inválido.");
  if (!group) return FAIL("Escribe el grupo.");
  if (!professorId) return FAIL("Escoge un profesor.");

  const professor = await db().professor.findUnique({ where: { id: professorId } });
  if (!professor) return FAIL("Ese profesor ya no existe.");

  await db().groupAssignment.upsert({
    where: { semesterId_englishLevel_group: { semesterId, englishLevel, group } },
    update: { professorId },
    create: { semesterId, englishLevel, group, professorId },
  });

  const { count } = await db().enrollment.updateMany({
    where: { semesterId, englishLevel, group },
    data: { professorId },
  });

  await audit("assignment.save", {
    type: "GroupAssignment",
    id: `${englishLevel}-${group}`,
    payload: { professor: professor.name, reasignados: count },
  });

  refresh();
  return OK(
    `Inglés ${englishLevel}-${group} → ${professor.name}` +
      (count > 0 ? ` · ${count} alumno${count === 1 ? "" : "s"} reasignado${count === 1 ? "" : "s"}.` : "."),
  );
}

export async function removeAssignment(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const denied = await guard();
  if (denied) return denied;

  const id = String(formData.get("assignmentId") ?? "");
  const assignment = await db().groupAssignment.findUnique({ where: { id } });
  if (!assignment) return FAIL("Esa asignación ya no existe.");

  await db().groupAssignment.delete({ where: { id } });
  await audit("assignment.remove", { type: "GroupAssignment", id });

  refresh();
  return OK(`Quitada la asignación de Inglés ${assignment.englishLevel}-${assignment.group}.`);
}

/* ------------------------------------------------------------------ *
 * Reopen an attempt
 * ------------------------------------------------------------------ */

/**
 * Put a submitted attempt back to `in_progress` so a student can finish it.
 *
 * ⚠️ **This is NOT `/api/dev/rewind`.** That tool deletes responses in order to
 * rewind to a block, which is right for a developer re-walking a screen and
 * catastrophic for a real student: their answers are the measurement. This
 * action keeps every response and clears only the DERIVED scores, so the student
 * resumes at their first unanswered screen and the totals are recomputed on
 * submit. Nothing a student typed is destroyed.
 *
 * The scores must be cleared, though: an attempt back in progress that kept its
 * old `totalRaw` would sit in every report as a number that no longer matches
 * the responses underneath it.
 */
export async function reopenAttempt(
  _prev: ManageState,
  formData: FormData,
): Promise<ManageState> {
  const denied = await guard();
  if (denied) return denied;

  const attemptId = String(formData.get("attemptId") ?? "");
  const attempt = await db().attempt.findUnique({
    where: { id: attemptId },
    include: {
      enrollment: { select: { fullName: true, matricula: true } },
      window: { select: { phase: true, status: true } },
      _count: { select: { responses: true } },
    },
  });
  if (!attempt) return FAIL("Ese intento ya no existe.");
  if (attempt.state === "in_progress") return FAIL("Ese intento ya está abierto.");

  await db().attempt.update({
    where: { id: attemptId },
    data: {
      state: "in_progress",
      submittedAt: null,
      completed: false,
      anchorRaw: null,
      levelRaw: null,
      totalRaw: null,
      maxAnchor: null,
      maxLevel: null,
      maxTotal: null,
      durationMs: null,
      lastActivityAt: new Date(),
    },
  });

  await audit("attempt.reopen", {
    type: "Attempt",
    id: attemptId,
    payload: {
      matricula: attempt.enrollment.matricula,
      fase: attempt.window.phase,
      totalAnterior: attempt.totalRaw,
      respuestasConservadas: attempt._count.responses,
    },
  });

  // ⚠️ Deliberately NOT `refresh()`, unlike every other action here.
  // `revalidatePath` re-renders the attempt list, which swaps this row to its
  // "ya está abierto" branch and destroys the client component holding the
  // result — so the admin performed the action and saw no confirmation at all,
  // including the closed-window warning below. Found by clicking it. The message
  // is the more important half of this action; the list is one search away.

  // Said out loud because it is the thing an admin most needs to know next: a
  // reopened attempt in a CLOSED window cannot actually be continued.
  const warning =
    attempt.window.status === "open"
      ? ""
      : ` ⚠️ La ventana de ${attempt.window.phase === "entry" ? "entrada" : "salida"} está en "${attempt.window.status}", así que el alumno todavía no podrá entrar.`;

  return OK(
    `Reabierto el intento de ${attempt.enrollment.fullName}. Se conservaron sus ${attempt._count.responses} respuestas.${warning}`,
  );
}
