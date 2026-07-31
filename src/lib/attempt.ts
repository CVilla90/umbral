import type { FormId } from "./types";

/**
 * The rules that decide what a student is served and when. Pure functions, so
 * they are testable without a database — the DB layer calls into these rather
 * than reimplementing them inline in a route handler.
 */

export type Phase = "entry" | "exit";
export type WindowStatus = "draft" | "open" | "paused" | "closed";
export type AttemptState = "in_progress" | "submitted" | "auto_submitted";

export interface WindowLike {
  id: string;
  phase: string;
  opensAt: Date;
  closesAt: Date;
  status: string;
}

/**
 * A window admits students only when BOTH the schedule and the switch agree.
 *
 * They are separate on purpose (PLAN §4.1): "pause right now" must not destroy
 * the dates it is pausing, and re-opening must not require retyping them.
 */
export function windowIsOpen(w: WindowLike, now: Date = new Date()): boolean {
  if (w.status !== "open") return false;
  return now >= w.opensAt && now <= w.closesAt;
}

/** Why a window is not available, in the interface's own voice. */
export function windowClosedReason(
  w: WindowLike | null,
  now: Date = new Date(),
): "no-window" | "paused" | "too-early" | "too-late" | null {
  if (!w) return "no-window";
  if (w.status === "paused" || w.status === "draft") return "paused";
  if (w.status === "closed") return "too-late";
  if (now < w.opensAt) return "too-early";
  if (now > w.closesAt) return "too-late";
  return null;
}

/**
 * Which of the two windows a student should be working in right now.
 *
 * Entry is preferred when both are somehow open, because a student who has not
 * been measured yet must be measured before they can be re-measured — an exit
 * score with no baseline is the one result this instrument cannot use.
 */
export function activeWindow(windows: WindowLike[], now: Date = new Date()): WindowLike | null {
  const open = windows.filter((w) => windowIsOpen(w, now));
  return open.find((w) => w.phase === "entry") ?? open[0] ?? null;
}

/**
 * THE counterbalancing rule (PLAN §2.1).
 *
 * `formOrder` is assigned "AB" or "BA" once, 50/50, at enrollment. Entry serves
 * the first letter and exit serves the second, so a student can never meet the
 * same form twice — repeat prevention is a property of this function, not of a
 * per-student ledger that could drift out of sync.
 */
export function formFor(formOrder: string, phase: Phase): FormId {
  const order = formOrder === "BA" ? (["B", "A"] as const) : (["A", "B"] as const);
  return phase === "entry" ? order[0] : order[1];
}

/** 50/50, called once per enrollment. */
export function randomFormOrder(): "AB" | "BA" {
  return Math.random() < 0.5 ? "AB" : "BA";
}

/** Seeds the per-attempt option shuffle. Stored, so the paper is reconstructable. */
export function newOptionSeed(): number {
  return Math.floor(Math.random() * 2 ** 31);
}

/**
 * An attempt left open is closed after this long without activity.
 *
 * Not a timer and not visible to the student (PLAN §13). It exists so an
 * abandoned entry attempt cannot lock someone out of the exit window, since one
 * attempt per window is a hard unique constraint.
 */
export const IDLE_DAYS = 14;

export function isStale(lastActivityAt: Date, now: Date = new Date()): boolean {
  return now.getTime() - lastActivityAt.getTime() > IDLE_DAYS * 86_400_000;
}

/**
 * Scores are stored raw and turned into percentages on read, so fixing a scoring
 * rule reflows history instead of stranding it.
 */
export function pct(raw: number | null, max: number | null): number | null {
  if (raw === null || max === null || max <= 0) return null;
  return Math.round((raw / max) * 1000) / 10;
}

/** Gain between two attempts. Null unless both exist — never silently zero. */
export function gain(entry: number | null, exit: number | null): number | null {
  if (entry === null || exit === null) return null;
  return Math.round((exit - entry) * 10) / 10;
}

/** Whole days between two submissions — a covariate, not a constraint (PLAN §4.3). */
export function daysBetween(a: Date | null, b: Date | null): number | null {
  if (!a || !b) return null;
  return Math.round(Math.abs(b.getTime() - a.getTime()) / 86_400_000);
}
