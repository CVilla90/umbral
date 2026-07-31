import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import Player from "@/components/player/Player";
import type { ClientStep } from "@/components/player/types";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { loadStudentState, startOrResume, stepsForAttempt } from "@/lib/student";
import { itemSeed, optionOrder, shuffled } from "@/lib/shuffle";
import type { Step } from "@/lib/steps";

export const dynamic = "force-dynamic";

/**
 * Loads (or creates) the attempt for the open window and hands the player a
 * SAFE projection of it.
 *
 * `toClientStep` is the security boundary of the whole check-in: it copies field
 * by field, so `correct` and `accepted` cannot reach the browser. Passing bank
 * items straight through would put the answer key in the page source of a live
 * instrument — and a student who views source once tells everyone.
 */
export default async function Prueba() {
  const session = await getSession();
  if (!session) redirect("/");

  const state = await loadStudentState(session.userId);
  if (!state.enrollment) redirect("/ficha");
  if (!state.window) redirect("/inicio");

  const attempt = await startOrResume(state.enrollment.id, state.window.id);
  if (!attempt) redirect("/inicio");
  if (attempt.state !== "in_progress") redirect("/resultado");

  const steps = stepsForAttempt(attempt.englishLevel, attempt.form, attempt.itemSnapshot);

  const done = await db().response.findMany({
    where: { attemptId: attempt.id },
    select: { itemId: true },
  });
  const answered = new Set(done.map((d) => d.itemId));

  // Resume where they stopped: the first unanswered screen. A student who lost
  // their connection returns to the question they were on, not to the beginning.
  const firstUnanswered = steps.findIndex((s) => !answered.has(s.item.id));
  const startIndex = firstUnanswered === -1 ? steps.length - 1 : firstUnanswered;

  const clientSteps = steps.map((s) => toClientStep(s, attempt.optionSeed));

  return (
    <Shell email={session.email}>
      <Player
        attemptId={attempt.id}
        steps={clientSteps}
        startIndex={startIndex}
        answered={[...answered]}
      />
    </Shell>
  );
}

function toClientStep(step: Step, seed: number): ClientStep {
  const item = step.item;
  const base: ClientStep = {
    id: item.id,
    type: item.type,
    block: step.block,
    blockTitle: step.blockTitle,
    instruction: step.instruction,
    posInBlock: step.posInBlock,
    blockSize: step.blockSize,
    passage: step.passage,
    // `src` only. The clip's transcript stays on the server — see the note on
    // `ClientStep.audioSrc`.
    audioSrc: item.audio?.src ?? step.audio?.src,
  };

  switch (item.type) {
    case "mcq":
      return {
        ...base,
        stem: item.stem,
        // Shuffled here, per attempt, from the stored seed — this is what removes
        // the inherited "option c is never right" skew (PLAN §2.3).
        choices: optionOrder(item.choices.length, itemSeed(seed, item.id)).map(
          (authored) => item.choices[authored],
        ),
      };
    case "tf":
      return { ...base, sentence: item.sentence };
    case "open":
      return { ...base, stem: item.stem };
    case "match":
      return {
        ...base,
        lefts: item.pairs.map((p) => p.left),
        // Right column shuffled independently, or the answer would be "pick the
        // one on the same row".
        rights: shuffled(
          item.pairs.map((p) => p.right),
          itemSeed(seed, item.id),
        ),
      };
    case "gap":
      return {
        ...base,
        wordBank: shuffled(item.wordBank, itemSeed(seed, item.id)),
        segments: item.segments.map((s) =>
          s.kind === "blank" ? { kind: "blank", n: s.n } : s,
        ),
      };
    case "speaking":
      return { ...base, stem: item.stem, maxSeconds: item.maxSeconds };
  }
}
