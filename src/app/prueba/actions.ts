"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { gradeItem, type Response as GradedResponse } from "@/lib/grading";
import { itemSeed, optionOrder } from "@/lib/shuffle";
import { stepsForAttempt, submitAttempt } from "@/lib/student";
import { windowIsOpen } from "@/lib/attempt";

/**
 * Saving an answer.
 *
 * Every answer is written the moment it is given, which is what makes a dropped
 * connection resume instead of restart (PLAN §4.4). There is no "submit the whole
 * paper" moment that can be lost.
 *
 * Grading happens here rather than at submit time so that a partial attempt
 * closed by the idle sweep already carries real scores.
 */

export interface SavePayload {
  attemptId: string;
  itemId: string;
  /** For mcq: the index AS DISPLAYED. The authored index is derived server-side
   *  from the attempt's stored seed, so the client never learns which option was
   *  authored as correct — and a tampered index still lands on a real option. */
  displayIndex?: number | null;
  boolValue?: boolean | null;
  textValue?: string;
  mapValue?: Record<string, string>;
  msElapsed?: number;
  skipped?: boolean;
  skipReason?: string | null;
}

export async function saveResponse(payload: SavePayload): Promise<{ ok: boolean }> {
  const session = await getSession();
  if (!session) return { ok: false };

  const attempt = await db().attempt.findUnique({
    where: { id: payload.attemptId },
    include: { enrollment: true, window: true },
  });

  // Ownership, state and window are all re-checked here. A client that keeps a
  // stale tab open past the closing date must not be able to keep writing.
  if (!attempt || attempt.enrollment.userId !== session.userId) return { ok: false };
  if (attempt.state !== "in_progress") return { ok: false };
  if (!windowIsOpen(attempt.window)) return { ok: false };

  const steps = stepsForAttempt(attempt.englishLevel, attempt.form, attempt.itemSnapshot);
  const step = steps.find((s) => s.item.id === payload.itemId);
  if (!step) return { ok: false };

  const item = step.item;
  let graded: GradedResponse | null = null;
  let raw: unknown = null;

  if (!payload.skipped) {
    switch (item.type) {
      case "mcq": {
        const shown = payload.displayIndex;
        if (typeof shown === "number" && shown >= 0 && shown < item.choices.length) {
          const order = optionOrder(item.choices.length, itemSeed(attempt.optionSeed, item.id));
          const authored = order[shown];
          graded = { kind: "mcq", value: authored };
          raw = { authored, shown };
        } else {
          graded = { kind: "mcq", value: null };
        }
        break;
      }
      case "tf":
        graded = { kind: "tf", value: payload.boolValue ?? null };
        raw = payload.boolValue ?? null;
        break;
      case "open":
        graded = { kind: "open", value: payload.textValue ?? "" };
        raw = payload.textValue ?? "";
        break;
      case "match":
        graded = { kind: "match", value: payload.mapValue ?? {} };
        raw = payload.mapValue ?? {};
        break;
      case "gap":
        graded = { kind: "gap", value: payload.mapValue ?? {} };
        raw = payload.mapValue ?? {};
        break;
      case "speaking":
        // Speaking is written by the transcription route, not from here.
        return { ok: false };
    }
  }

  const points = gradeItem(item, graded);

  await db().response.upsert({
    where: { attemptId_itemId: { attemptId: attempt.id, itemId: item.id } },
    update: {
      raw: raw as never,
      correct: points === item.points,
      points,
      maxPoints: item.points,
      msElapsed: payload.msElapsed ?? null,
      skipped: Boolean(payload.skipped),
      skipReason: payload.skipReason ?? null,
    },
    create: {
      attemptId: attempt.id,
      itemId: item.id,
      block: step.block,
      type: item.type,
      raw: raw as never,
      correct: points === item.points,
      points,
      maxPoints: item.points,
      msElapsed: payload.msElapsed ?? null,
      skipped: Boolean(payload.skipped),
      skipReason: payload.skipReason ?? null,
    },
  });

  await db().attempt.update({
    where: { id: attempt.id },
    data: { lastActivityAt: new Date() },
  });

  return { ok: true };
}

export async function finishAttempt(attemptId: string): Promise<void> {
  const session = await getSession();
  if (!session) redirect("/");

  const attempt = await db().attempt.findUnique({
    where: { id: attemptId },
    include: { enrollment: true },
  });
  if (!attempt || attempt.enrollment.userId !== session.userId) redirect("/inicio");

  await submitAttempt(attemptId);
  redirect("/resultado");
}
