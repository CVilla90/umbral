import { NextResponse, type NextRequest } from "next/server";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { gradeItem } from "@/lib/grading";
import { stepsForAttempt } from "@/lib/student";
import { windowIsOpen } from "@/lib/attempt";
import {
  ACCEPTED_AUDIO_MIME,
  MAX_AUDIO_BYTES,
  MAX_CALLS_PER_ATTEMPT,
  MAX_TRIES_PER_ITEM,
  GEMINI_MODEL,
  speakingEnabled,
  transcribe,
} from "@/lib/ai/gemini";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Transcribe one spoken answer, grade it deterministically, store it.
 *
 * This route is the second security boundary of the check-in (the first is
 * `prueba/page.tsx`'s `toClientStep`). Two things it deliberately never returns:
 *
 *   1. **Whether the answer was correct.** Umbral is a measurement, not a lesson.
 *      Telling a student "correct!" mid-instrument turns the retry into an answer
 *      oracle — record, see it was wrong, record again — and the speaking score
 *      stops measuring speaking and starts measuring persistence.
 *   2. **The accepted answers.** They never leave the server, same as everywhere.
 *
 * What it DOES return is the transcript, because the student has a legitimate
 * need to know the microphone worked. "Escuchamos: ..." answers that without
 * answering anything else, and it is what makes the one retry honest: the retry
 * exists for a garbled recording, not for a second guess.
 *
 * Every ceiling in PLAN §7 is enforced here, server-side, from stored rows. The
 * client is never trusted with a counter.
 */

/** Client-declared clip length above this is rejected outright. The recorder caps
 *  at the item's `maxSeconds` (≤20); 25s is slack for timer jitter, not licence. */
const MAX_DECLARED_MS = 25_000;

interface Failure {
  status: number;
  code: string;
  message: string;
}

function fail({ status, code, message }: Failure) {
  return NextResponse.json({ ok: false, code, message }, { status });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return fail({ status: 401, code: "no_session", message: "Inicia sesión otra vez." });

  const form = await request.formData().catch(() => null);
  if (!form) return fail({ status: 400, code: "bad_form", message: "Envío inválido." });

  const attemptId = String(form.get("attemptId") ?? "");
  const itemId = String(form.get("itemId") ?? "");
  const declaredMs = Number(form.get("ms") ?? 0) || null;
  const audio = form.get("audio");

  if (!attemptId || !itemId || !(audio instanceof Blob)) {
    return fail({ status: 400, code: "bad_form", message: "Envío inválido." });
  }

  // --- ownership, state, window ------------------------------------------------
  // Re-checked here rather than trusted from the page that rendered the button: a
  // stale tab left open past the closing date must not be able to keep writing.
  const attempt = await db().attempt.findUnique({
    where: { id: attemptId },
    include: { enrollment: true, window: true },
  });
  if (!attempt || attempt.enrollment.userId !== session.userId) {
    return fail({ status: 404, code: "no_attempt", message: "No encontramos tu intento." });
  }
  if (attempt.state !== "in_progress") {
    return fail({ status: 409, code: "submitted", message: "Este intento ya está entregado." });
  }
  if (!windowIsOpen(attempt.window)) {
    return fail({ status: 409, code: "window_closed", message: "La ventana ya cerró." });
  }

  const steps = stepsForAttempt(attempt.englishLevel, attempt.form, attempt.itemSnapshot);
  const step = steps.find((s) => s.item.id === itemId);
  if (!step || step.item.type !== "speaking") {
    return fail({ status: 400, code: "not_speaking", message: "Esa pregunta no es hablada." });
  }
  const item = step.item;

  // --- the response row must exist before anything can reference it ------------
  const response = await db().response.upsert({
    where: { attemptId_itemId: { attemptId: attempt.id, itemId: item.id } },
    update: {},
    create: {
      attemptId: attempt.id,
      itemId: item.id,
      block: step.block,
      type: item.type,
      maxPoints: item.points,
    },
  });

  // --- the kill switch --------------------------------------------------------
  // Degrades to a recorded, zero-scoring skip rather than an error screen. A
  // student still finishes; an unanswered speaking item scores 0 either way
  // (PLAN §2.4), so the instrument stays internally consistent.
  if (!speakingEnabled()) {
    await db().response.update({
      where: { id: response.id },
      data: { skipped: true, skipReason: "no_mic", points: 0, correct: false },
    });
    return NextResponse.json({
      ok: false,
      code: "speaking_disabled",
      message: "Las preguntas habladas no están disponibles ahora. Puedes continuar.",
    });
  }

  // --- payload ceilings (PLAN §7) ---------------------------------------------
  // `type` on a Blob is client-supplied, so this is a filter, not a guarantee —
  // the real protection is that Gemini rejects anything that is not actually
  // audio, and that `bytes` is measured here rather than declared.
  const mime = (audio.type || "").split(";")[0].trim().toLowerCase();
  if (!ACCEPTED_AUDIO_MIME.includes(mime as (typeof ACCEPTED_AUDIO_MIME)[number])) {
    return fail({ status: 415, code: "bad_mime", message: "Formato de audio no admitido." });
  }
  if (audio.size > MAX_AUDIO_BYTES) {
    return fail({ status: 413, code: "too_big", message: "La grabación es demasiado larga." });
  }
  if (audio.size === 0) {
    return fail({ status: 400, code: "empty", message: "No recibimos audio. Intenta de nuevo." });
  }
  if (declaredMs !== null && declaredMs > MAX_DECLARED_MS) {
    return fail({ status: 413, code: "too_long", message: "La grabación es demasiado larga." });
  }

  // --- quota ceilings, counted from stored rows -------------------------------
  const callsThisAttempt = await db().speakingCall.count({
    where: { response: { attemptId: attempt.id } },
  });
  if (callsThisAttempt >= MAX_CALLS_PER_ATTEMPT) {
    return fail({
      status: 429,
      code: "attempt_quota",
      message: "Ya usaste tus intentos de grabación. Puedes continuar.",
    });
  }
  if (response.triesUsed >= MAX_TRIES_PER_ITEM) {
    return fail({
      status: 429,
      code: "item_quota",
      message: "Ya grabaste esta pregunta dos veces. Puedes continuar.",
    });
  }

  // --- the only network call in the whole check-in ----------------------------
  const bytes = Buffer.from(await audio.arrayBuffer());
  const result = await transcribe(bytes, mime, item.target);

  await db().speakingCall.create({
    data: {
      responseId: response.id,
      model: result.ok ? result.model : GEMINI_MODEL,
      bytes: bytes.byteLength,
      audioMs: declaredMs,
      latencyMs: result.latencyMs,
      apiCalls: result.apiCalls,
      ok: result.ok,
      errorCode: result.ok ? null : result.error.slice(0, 200),
    },
  });

  const triesUsed = response.triesUsed + 1;

  if (!result.ok) {
    // Our outage, not their answer — so the try is consumed (it really did cost
    // requests) but the row is left unskipped and scoring 0, and `errorCode`
    // above is what tells the difference later.
    await db().response.update({
      where: { id: response.id },
      data: { triesUsed, msElapsed: declaredMs },
    });
    return NextResponse.json({
      ok: false,
      code: "transcription_failed",
      message: "No pudimos procesar el audio. Puedes intentar otra vez o continuar.",
      triesRemaining: Math.max(0, MAX_TRIES_PER_ITEM - triesUsed),
    });
  }

  const transcript = result.text;
  const heard = transcript.length > 0;

  // Deterministic, in `lib/grading.ts`, with the same `gradeOpen` that grades a
  // typed answer. Gemini never sees a score and never assigns one.
  const points = heard ? gradeItem(item, { kind: "speaking", transcript }) : 0;

  await db().response.update({
    where: { id: response.id },
    data: {
      raw: { transcript, mime, bytes: bytes.byteLength } as never,
      // A student is never penalised for the WORSE of two recordings: the best
      // score stands. Re-recording is meant to fix a bad microphone, and a rule
      // that could lower your score would make using the retry a gamble.
      points: Math.max(points, response.points),
      correct: Math.max(points, response.points) === item.points,
      triesUsed,
      msElapsed: declaredMs,
      skipped: false,
      skipReason: heard ? null : "no_mic",
    },
  });

  await db().attempt.update({
    where: { id: attempt.id },
    data: { lastActivityAt: new Date() },
  });

  // Note what is absent: `correct`, `points`, `accepted`. See the header.
  return NextResponse.json({
    ok: true,
    transcript,
    heard,
    triesRemaining: Math.max(0, MAX_TRIES_PER_ITEM - triesUsed),
  });
}
