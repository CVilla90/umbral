import { NextResponse, type NextRequest } from "next/server";
import { appUrl } from "@/lib/auth/google";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { devToolsEnabled, notFound } from "@/lib/dev";
import { loadStudentState, stepsForAttempt } from "@/lib/student";
import type { Block } from "@/lib/types";

/**
 * Development-only: rewind the signed-in student's attempt to the start of a
 * block, so a screen can be re-tested without clicking through 28 of them and
 * without hand-editing the database.
 *
 *   /api/dev/rewind?to=listening   -> lands on the first listening item
 *   /api/dev/rewind?to=speaking    -> lands on the first speaking item
 *   /api/dev/rewind                -> back to the very first screen
 *
 * Gated by `devToolsEnabled()` (see `lib/dev.ts`) AND scoped to the caller's own
 * attempt — it reads the attempt from the session, never from a parameter, so
 * even with the gate mistakenly open it cannot touch another student's data.
 *
 * **It rewinds; it does not fabricate.** Responses before the target block are
 * left exactly as the student gave them, and the ones from the target block
 * onward are deleted rather than blanked, so `/prueba`'s "first unanswered
 * screen" resume rule does the navigating. `optionSeed` and `itemSnapshot` are
 * untouched, so the re-walk shows the same paper in the same order.
 *
 * The attempt's scores are cleared alongside, because a submitted attempt that
 * is now missing responses would otherwise keep a `totalRaw` that no longer
 * matches what is stored — a stale number in the one table the whole instrument
 * is read from later.
 */
export async function GET(request: NextRequest) {
  if (!devToolsEnabled()) return notFound();

  const session = await getSession();
  if (!session) return NextResponse.redirect(new URL("/", appUrl()));

  const state = await loadStudentState(session.userId);
  if (!state.enrollment || !state.window) {
    return NextResponse.redirect(new URL("/inicio", appUrl()));
  }

  const attempt = await db().attempt.findUnique({
    where: {
      enrollmentId_windowId: {
        enrollmentId: state.enrollment.id,
        windowId: state.window.id,
      },
    },
  });
  // Nothing to rewind — /prueba will start a fresh attempt.
  if (!attempt) return NextResponse.redirect(new URL("/prueba", appUrl()));

  const steps = stepsForAttempt(attempt.englishLevel, attempt.form, attempt.itemSnapshot);

  const to = request.nextUrl.searchParams.get("to")?.trim().toLowerCase();
  const from = to ? steps.findIndex((s) => s.block === (to as Block)) : 0;
  if (from === -1) {
    const blocks = [...new Set(steps.map((s) => s.block))].join(", ");
    return new NextResponse(
      `Unknown block "${to}". This attempt has: ${blocks}`,
      { status: 400 },
    );
  }

  const doomed = steps.slice(from).map((s) => s.item.id);
  const { count } = await db().response.deleteMany({
    where: { attemptId: attempt.id, itemId: { in: doomed } },
  });

  await db().attempt.update({
    where: { id: attempt.id },
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

  console.warn(
    `[dev-rewind] ${session.email}: deleted ${count} response(s) from step ${from + 1}/${steps.length}` +
      ` (${steps[from].block}) — never enable this in production`,
  );

  return NextResponse.redirect(new URL("/prueba", appUrl()));
}
