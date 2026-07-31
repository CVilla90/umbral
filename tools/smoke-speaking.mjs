/**
 * Live smoke test for the speaking path.
 *
 * Run:
 *   node --env-file-if-exists=.env --experimental-strip-types tools/smoke-speaking.mjs
 *
 * WHY THIS EXISTS, and why it probes three formats rather than one:
 *
 * The recurring failure across Carlos's projects is a model that answers text
 * perfectly and returns **500 INTERNAL on any audio part** — which reads like a
 * provider outage and is not one. It has cost debugging time twice. The lesson
 * banked from it is that the working combination is a product of
 * MODEL × FORMAT × TRANSPORT, so proving `gemini-3.5-flash` transcribes an MP3
 * proves nothing about the `audio/webm;codecs=opus` that MediaRecorder actually
 * produces in a student's browser.
 *
 * So: one known clip, transcoded to all three mimes the route accepts, each sent
 * through the real `transcribe()` the app calls. The expected words are known
 * because the source clip is one of our own listening items.
 *
 * This spends real quota — roughly 3 calls. It is not part of `npm test`.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const { transcribe, GEMINI_MODEL } = await import("../src/lib/ai/gemini.ts");

// One of our own listening clips, so the expected transcript is known exactly.
const SOURCE = "public/audio/listening/l1a-li-1.mp3";
const EXPECTED = "Hi! My name is Sofía. I'm twenty years old and I study medicine.";
/** Words that must appear for the transcription to be considered working. */
const MUST_CONTAIN = ["name", "medicine"];

/** The three mimes `ACCEPTED_AUDIO_MIME` allows, and what really produces them. */
const FORMATS = [
  { mime: "audio/webm", ext: "webm", args: ["-c:a", "libopus"], note: "Chrome/Firefox MediaRecorder" },
  { mime: "audio/ogg", ext: "ogg", args: ["-c:a", "libopus"], note: "Firefox fallback" },
  { mime: "audio/mp4", ext: "m4a", args: ["-c:a", "aac"], note: "Safari / iOS" },
];

if (!process.env.GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY is not set. Add it to .env first — see HANDOFF §4.");
  process.exit(1);
}

const work = mkdtempSync(join(tmpdir(), "umbral-smoke-"));
let failures = 0;

console.log(`\nmodel:    ${GEMINI_MODEL}`);
console.log(`source:   ${SOURCE}`);
console.log(`expected: "${EXPECTED}"\n`);

try {
  for (const format of FORMATS) {
    const out = join(work, `clip.${format.ext}`);
    execFileSync("ffmpeg", ["-y", "-loglevel", "error", "-i", SOURCE, ...format.args, out]);
    const bytes = readFileSync(out);

    const started = Date.now();
    const result = await transcribe(bytes, format.mime, EXPECTED);
    const wall = Date.now() - started;

    const label = `${format.mime.padEnd(11)} (${format.note})`;
    if (!result.ok) {
      failures++;
      console.log(`FAIL  ${label}`);
      for (const step of result.trail) {
        // The trail, not just the last error: "the fallback rejected a parameter"
        // and "the primary 503'd twice first" are different diagnoses.
        console.log(`      ${step.model.padEnd(18)} ${step.error.replace(/\s+/g, " ").slice(0, 130)}`);
      }
      console.log(`      ${result.apiCalls} api call(s), ${wall}ms\n`);
      continue;
    }

    const heard = result.text.toLowerCase();
    const missing = MUST_CONTAIN.filter((w) => !heard.includes(w));
    const ok = missing.length === 0;
    if (!ok) failures++;

    console.log(`${ok ? "PASS" : "FAIL"}  ${label}`);
    console.log(`      heard: "${result.text}"`);
    if (!ok) console.log(`      missing expected word(s): ${missing.join(", ")}`);
    console.log(
      `      ${result.model}, ${result.apiCalls} api call(s), ${result.latencyMs}ms (${(bytes.length / 1024).toFixed(1)} KB)\n`,
    );
  }
} finally {
  rmSync(work, { recursive: true, force: true });
}

if (failures) {
  console.error(`${failures} of ${FORMATS.length} formats failed.`);
  console.error("A failure on webm is a SHIP BLOCKER — it is what real browsers send.");
  process.exit(1);
}
console.log(`All ${FORMATS.length} formats transcribed correctly.`);
