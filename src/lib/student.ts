import { db } from "./db";
import {
  activeWindow,
  formFor,
  isStale,
  newOptionSeed,
  windowClosedReason,
  type Phase,
} from "./attempt";
import { getForm, isLevel, type Level } from "@/content/forms";
import { snapshotOf, stepsFromSnapshot, type Step } from "./steps";
import { formPoints } from "./types";

/**
 * Everything the student pages need from the database, in one place, so a page
 * component never assembles measurement state inline.
 *
 * The invariant this file protects: an attempt's form and item list are decided
 * ONCE, at creation, and everything afterwards reads them back from the row. A
 * page that recomputed "which form?" on each render could serve a student two
 * different papers across a reconnection.
 */

export interface StudentState {
  semester: { id: string; label: string } | null;
  enrollment: Awaited<ReturnType<typeof loadEnrollment>>;
  window: { id: string; phase: Phase } | null;
  closedReason: ReturnType<typeof windowClosedReason>;
  /** Submitted attempts this semester, for the "already done" states. */
  done: { phase: Phase; totalRaw: number | null; maxTotal: number | null }[];
}

async function loadEnrollment(userId: string, semesterId: string) {
  return db().enrollment.findUnique({
    where: { userId_semesterId: { userId, semesterId } },
  });
}

export async function loadStudentState(userId: string): Promise<StudentState> {
  const semester = await db().semester.findFirst({
    where: { isActive: true },
    include: { windows: true },
  });

  if (!semester) {
    return { semester: null, enrollment: null, window: null, closedReason: "no-window", done: [] };
  }

  const enrollment = await loadEnrollment(userId, semester.id);
  const open = activeWindow(semester.windows);

  // When nothing is open, report on the window that is *closest to relevant* so
  // the student is told "todavía no" rather than a blank "no hay nada".
  const soonest =
    open ??
    [...semester.windows].sort((a, b) => a.opensAt.getTime() - b.opensAt.getTime()).find(
      (w) => w.closesAt >= new Date(),
    ) ??
    semester.windows[0] ??
    null;

  const done = enrollment
    ? (
        await db().attempt.findMany({
          where: { enrollmentId: enrollment.id, state: { not: "in_progress" } },
          include: { window: true },
        })
      ).map((a) => ({
        phase: a.window.phase as Phase,
        totalRaw: a.totalRaw,
        maxTotal: a.maxTotal,
      }))
    : [];

  return {
    semester: { id: semester.id, label: semester.label },
    enrollment,
    window: open ? { id: open.id, phase: open.phase as Phase } : null,
    closedReason: windowClosedReason(soonest),
    done,
  };
}

/**
 * Starts the attempt for this window, or resumes the one already in progress.
 *
 * The unique constraint on (enrollment, window) is what makes "one attempt per
 * window" real; this function is the only thing that creates one, so the form and
 * the item snapshot are decided exactly once.
 */
export async function startOrResume(enrollmentId: string, windowId: string) {
  const existing = await db().attempt.findUnique({
    where: { enrollmentId_windowId: { enrollmentId, windowId } },
    include: { responses: true },
  });

  if (existing) {
    if (existing.state === "in_progress" && isStale(existing.lastActivityAt)) {
      // Abandoned. Close it on what was answered rather than leaving it to block
      // the next window — see PLAN §4.4.
      await submitAttempt(existing.id, "auto_submitted");
      return db().attempt.findUnique({
        where: { id: existing.id },
        include: { responses: true },
      });
    }
    return existing;
  }

  const enrollment = await db().enrollment.findUnique({ where: { id: enrollmentId } });
  const window = await db().window.findUnique({ where: { id: windowId } });
  if (!enrollment || !window) throw new Error("enrollment or window missing");
  if (!isLevel(enrollment.englishLevel)) throw new Error("bad english level");

  const form = formFor(enrollment.formOrder, window.phase as Phase);
  const built = getForm(enrollment.englishLevel as Level, form);

  return db().attempt.create({
    data: {
      enrollmentId,
      windowId,
      form,
      englishLevel: enrollment.englishLevel,
      optionSeed: newOptionSeed(),
      itemSnapshot: snapshotOf(built),
      maxTotal: formPoints(built),
    },
    include: { responses: true },
  });
}

/** The steps a given attempt saw, rebuilt from its own snapshot. */
export function stepsForAttempt(level: number, form: string, snapshot: unknown): Step[] {
  const built = getForm(level as Level, form === "B" ? "B" : "A");
  const ids = Array.isArray(snapshot) ? (snapshot as string[]) : [];
  return ids.length ? stepsFromSnapshot(built, ids) : stepsFromSnapshot(built, snapshotOf(built));
}

/**
 * Freezes an attempt and writes its raw scores.
 *
 * Only RAW counts are stored. Percentages and gain are derived on read, so a
 * scoring fix reflows history rather than stranding it (PLAN §5).
 */
export async function submitAttempt(
  attemptId: string,
  state: "submitted" | "auto_submitted" = "submitted",
) {
  const attempt = await db().attempt.findUnique({
    where: { id: attemptId },
    include: { responses: true },
  });
  if (!attempt || attempt.state !== "in_progress") return attempt;

  const steps = stepsForAttempt(attempt.englishLevel, attempt.form, attempt.itemSnapshot);
  const byId = new Map(attempt.responses.map((r) => [r.itemId, r]));

  let anchorRaw = 0;
  let maxAnchor = 0;
  let levelRaw = 0;
  let maxLevel = 0;

  for (const step of steps) {
    const points = byId.get(step.item.id)?.points ?? 0;
    const max = step.item.points;
    if (step.block === "anchor") {
      anchorRaw += points;
      maxAnchor += max;
    } else {
      levelRaw += points;
      maxLevel += max;
    }
  }

  const answered = steps.filter((s) => byId.has(s.item.id)).length;

  return db().attempt.update({
    where: { id: attemptId },
    data: {
      state,
      submittedAt: new Date(),
      anchorRaw,
      maxAnchor,
      levelRaw,
      maxLevel,
      totalRaw: anchorRaw + levelRaw,
      maxTotal: maxAnchor + maxLevel,
      durationMs: Date.now() - attempt.startedAt.getTime(),
      // "Completed" means every screen was reached, not that every answer was
      // right. Partial attempts are kept and flagged, never discarded.
      completed: answered === steps.length,
    },
  });
}
