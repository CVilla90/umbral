import { GoogleGenAI, ThinkingLevel } from "@google/genai";

/**
 * The only runtime AI in Umbral, and it has exactly one job: turn sound into text.
 *
 * It does NOT grade. `lib/grading.ts` decides whether the transcript is right,
 * using the same `gradeOpen` that grades a typed answer (PLAN §7). That is not a
 * stylistic preference — a measurement instrument has to be able to defend a
 * score to a student and to a thesis committee, and "the model said so" is not a
 * defensible scoring rule. Keeping this file free of any scoring logic is what
 * makes that claim literally true rather than aspirational.
 *
 * Ported from `../WISHUB/src/lib/ai/gemini.ts`, with the grading call removed and
 * the retry/fallback behaviour kept.
 *
 * Inert without a key: the client is never constructed unless GEMINI_API_KEY is
 * set, so a missing key degrades speaking to `skipped` instead of throwing.
 */

/**
 * Audio-capable models, tried in order.
 *
 * ⚠️ **Never a `-lite` tier.** Not every Gemini model accepts audio input. The
 * lite tiers answer text fine but return **500 INTERNAL on any audio part**,
 * which reads like a provider outage and is not one. This has cost debugging time
 * twice across Carlos's projects. Verified against the live API (2026-07-13,
 * VillaAula): `gemini-3.5-flash` transcribes webm/opus — what MediaRecorder gives
 * us — plus mp3, ogg and mp4; `gemini-2.5-flash` is the audio-capable fallback.
 *
 * Re-probe with a real clip before swapping either one.
 */
export const GEMINI_MODEL = process.env.GEMINI_SPEAKING_MODEL || "gemini-3.5-flash";

/**
 * ⚠️ **The thinking parameter is not the same across generations, and getting it
 * wrong silently disables the fallback.** Found by the live smoke test on
 * 2026-07-31: sending `thinkingLevel` (a Gemini 3.x parameter) to
 * `gemini-2.5-flash` returns **400 INVALID_ARGUMENT "Thinking level is not
 * supported for this model"** — so the fallback never worked, and it would only
 * ever have been exercised when the primary was already failing. An error handler
 * that has never fired is not known to work; this one had never fired.
 *
 * 2.5 takes `thinkingBudget: 0` to mean the same thing. Both settings exist for
 * the same reason: transcription needs no reasoning, and thinking doubles
 * wall-clock time on the free tier.
 */
const SPEAKING_MODELS = [GEMINI_MODEL, "gemini-2.5-flash"];

/**
 * Derived from the model NAME, never from its position in the list — otherwise
 * setting `GEMINI_SPEAKING_MODEL=gemini-2.5-flash` would hand 2.5 the very
 * parameter it rejects, reintroducing the same 400 through the env var that the
 * fallback list was just fixed for.
 */
export function thinkingFor(model: string): Record<string, unknown> {
  return /^gemini-[0-2]\./.test(model)
    ? { thinkingBudget: 0 }
    : { thinkingLevel: ThinkingLevel.LOW };
}

/** Free-tier audio capacity genuinely 503s, so transient errors get one retry. */
const MAX_ATTEMPTS_PER_MODEL = 2;
const TRANSIENT = /\b(429|500|502|503|504)\b|INTERNAL|UNAVAILABLE|RESOURCE_EXHAUSTED/i;

/**
 * ⚠️ **Wall-clock guards, because the failure mode here is not an error — it is
 * silence.** An overloaded Gemini endpoint can take **110–127 s just to return a
 * 500** (measured in `../gemini_computer_use`). With four underlying requests in
 * the worst case, an unguarded `transcribe()` could hold a student on a spinner
 * for the better part of ten minutes and then fail anyway. No HTTP-level timeout
 * in the SDK saves us from that, so the budget is enforced here.
 *
 * Two separate guards, because they stop different things:
 *  - `CALL_TIMEOUT_MS` bounds ONE request.
 *  - `TRANSCRIBE_DEADLINE_MS` bounds the whole retry-and-fallback walk, which is
 *    what the student actually experiences.
 *
 * ⚠️ The SDK's `abortSignal` is documented as **client-only**: it stops us
 * waiting, it does not stop the service working, and the call is still billed.
 * That is precisely why an aborted request still increments `apiCalls` — the
 * quota record has to reflect what was spent, not what was received.
 */
export const CALL_TIMEOUT_MS = 20_000;
export const TRANSCRIBE_DEADLINE_MS = 45_000;

/** Mime types we accept from the browser and forward to Gemini. */
export const ACCEPTED_AUDIO_MIME = ["audio/webm", "audio/ogg", "audio/mp4"] as const;

/** Hard ceilings from PLAN §7, enforced server-side. The client is never trusted. */
export const MAX_AUDIO_BYTES = 1_000_000; // 20s of webm/opus is ~60 KB
export const MAX_TRIES_PER_ITEM = 2;
export const MAX_CALLS_PER_ATTEMPT = 4; // 2 speaking items × 2 tries

export function geminiConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * The kill switch (PLAN §7). Set `SPEAKING_ENABLED=false` to degrade speaking to
 * `skipped` without taking the app down — a student still finishes their
 * check-in, and still cannot reach 100 %, which is the agreed behaviour for an
 * unanswered speaking item either way.
 */
export function speakingEnabled(): boolean {
  return process.env.SPEAKING_ENABLED !== "false" && geminiConfigured();
}

let client: GoogleGenAI | null = null;
function getClient(): GoogleGenAI {
  if (!client) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
    client = new GoogleGenAI({ apiKey });
  }
  return client;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Always returned, never thrown, so the route can record a failed call as
 * faithfully as a successful one. A speaking item that failed on Gemini's side
 * and a speaking item the student never attempted must not look the same in the
 * data — one is our fault and the other is theirs.
 */
export type Transcription =
  | {
      ok: true;
      /** Verbatim, as heard. Empty when the clip is silent or unintelligible. */
      text: string;
      /** Which model actually answered — written to `SpeakingCall.model`. */
      model: string;
      latencyMs: number;
      /** Underlying API calls made, including retries. See `apiCalls` note below. */
      apiCalls: number;
    }
  | {
      ok: false;
      error: string;
      latencyMs: number;
      apiCalls: number;
      /** One entry per underlying request that failed, in order.
       *
       *  Kept because collapsing to "the last error" actively misleads: when the
       *  primary model 503s twice and the fallback then rejects a parameter, the
       *  last error describes the FALLBACK and hides that the primary was merely
       *  flaky. That is exactly what happened on 2026-07-31, and the trail is
       *  what made it diagnosable. */
      trail: { model: string; error: string }[];
    };

/** One call. Throws on any API error so the caller can retry or fall back. */
async function callOnce(
  model: string,
  thinking: Record<string, unknown>,
  audio: Buffer,
  mimeType: string,
  target: string,
  abortSignal: AbortSignal,
): Promise<string> {
  // The prompt names the target structure so the model has acoustic context for a
  // heavily accented beginner, but it is explicitly forbidden from repairing or
  // guessing it. A model that "helpfully" returns the target when it hears
  // nothing would silently award the point to a dead microphone — the one failure
  // mode that would corrupt the speaking measurement invisibly.
  const prompt = [
    "You are a patient transcriber of beginner English learners, whose first language is Spanish.",
    `For context only, the learner was asked to say something like: "${target}".`,
    "Transcribe EXACTLY what you hear in the audio, verbatim, in English.",
    "Do NOT correct grammar. Do NOT complete or repair partial sentences.",
    "Do NOT add punctuation beyond what is clearly spoken.",
    "If the clip is silent, empty, or unintelligible, return an empty string —",
    "never guess the target sentence.",
    'Return ONLY JSON: {"transcription": "<verbatim or empty>"}.',
  ].join(" ");

  const response = await getClient().models.generateContent({
    model,
    contents: [
      {
        role: "user",
        parts: [
          { text: prompt },
          { inlineData: { data: audio.toString("base64"), mimeType } },
        ],
      },
    ],
    config: {
      abortSignal,
      responseMimeType: "application/json",
      responseSchema: {
        type: "object",
        properties: { transcription: { type: "string" } },
        required: ["transcription"],
      },
      // Per-model — see the note on SPEAKING_MODELS. Sending the wrong
      // generation's parameter is a 400, not a warning.
      thinkingConfig: thinking,
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Empty response from Gemini");
  const parsed = JSON.parse(raw) as { transcription?: string };
  return (parsed.transcription ?? "").trim();
}

/**
 * Transcribe a spoken clip. Walks `SPEAKING_MODELS`, retrying each on transient
 * capacity errors — the free tier 503s on audio often enough to lose a student's
 * answer if we gave up on the first try.
 *
 * ⚠️ **`apiCalls` is why this is counted rather than assumed.** One student-facing
 * "analyse" is up to `SPEAKING_MODELS.length × MAX_ATTEMPTS_PER_MODEL` = 4
 * underlying requests when the tier is flaky. PLAN §7's per-attempt ceiling of 4
 * counts *student-initiated* analyses, so the underlying request count is a
 * different, larger number — and the only way "who burned the quota" stays a real
 * query rather than an estimate is to store what actually happened.
 */
export async function transcribe(
  audio: Buffer,
  mimeType: string,
  target: string,
): Promise<Transcription> {
  const startedAt = Date.now();
  const trail: { model: string; error: string }[] = [];
  let apiCalls = 0;

  for (const model of SPEAKING_MODELS) {
    for (let attempt = 1; attempt <= MAX_ATTEMPTS_PER_MODEL; attempt++) {
      const remaining = TRANSCRIBE_DEADLINE_MS - (Date.now() - startedAt);
      if (remaining <= 0) {
        trail.push({ model, error: "deadline exceeded before request" });
        return failed(trail, startedAt, apiCalls);
      }

      // Never let one request eat a budget the next model still needs.
      const budget = Math.min(CALL_TIMEOUT_MS, remaining);
      const timer = AbortSignal.timeout(budget);
      apiCalls++; // counted before the call: an aborted request is still billed.

      try {
        const text = await callOnce(model, thinkingFor(model), audio, mimeType, target, timer);
        return { ok: true, text, model, latencyMs: Date.now() - startedAt, apiCalls };
      } catch (error) {
        const timedOut = timer.aborted;
        const message = timedOut
          ? `timed out after ${budget}ms`
          : String((error as Error)?.message ?? error);
        trail.push({ model, error: message });

        // Two different reasons to abandon THIS model and move to the next:
        //  - a non-transient error (bad key, bad parameter, malformed audio) will
        //    fail identically on retry, so a second identical request is waste;
        //  - a timeout means this model just spent the better part of the budget,
        //    and giving it a second bite would consume what the fallback needs.
        //    Retrying here is how you build a system that never reaches its
        //    fallback precisely when it is slow enough to need one.
        // Neither is a reason to give up: the next model may well accept what
        // this one rejected, or answer while this one is congested.
        if (timedOut || !TRANSIENT.test(message)) break;
        if (attempt < MAX_ATTEMPTS_PER_MODEL) await sleep(600 * attempt);
      }
    }
  }

  return failed(trail, startedAt, apiCalls);
}

function failed(
  trail: { model: string; error: string }[],
  startedAt: number,
  apiCalls: number,
): Transcription {
  return {
    ok: false,
    error: trail[trail.length - 1]?.error ?? "Transcription failed",
    latencyMs: Date.now() - startedAt,
    apiCalls,
    trail,
  };
}
