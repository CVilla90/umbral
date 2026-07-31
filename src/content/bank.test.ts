import { existsSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { allForms, getForm, LEVELS } from "./forms";
import { ANCHOR } from "./anchor";
import { allListeningSpecs, LISTENING_VOICES } from "./listening";
import { gradeItem, normalize } from "@/lib/grading";
import { blockPoints, formPoints, type Form, type FormId, type Item } from "@/lib/types";

/**
 * The blueprint gate.
 *
 * This is the analogue of `english_test_generator/examstyle/validate.py`, and it
 * exists for the same reason: a measurement instrument that is only checked by
 * eye drifts, and every defect class asserted below has ALREADY happened once in
 * the printed exams. These are not hypothetical invariants.
 */

const FORMS: FormId[] = ["A", "B"];

function itemsOf(form: Form): Item[] {
  return form.blocks.flatMap((b) => b.items);
}

describe("every form is well formed", () => {
  it.each(allForms().map((f) => [`level ${f.level} form ${f.form}`, f] as const))(
    "%s",
    (_name, form) => {
      expect(form.blocks.length).toBeGreaterThan(0);
      for (const block of form.blocks) {
        expect(block.title.length).toBeGreaterThan(0);
        expect(block.instruction.length).toBeGreaterThan(0);
        expect(block.items.length).toBeGreaterThan(0);
      }
    },
  );

  it("no form repeats an item id within itself", () => {
    for (const form of allForms()) {
      const ids = itemsOf(form).map((i) => i.id);
      expect(new Set(ids).size, `level ${form.level} form ${form.form}`).toBe(ids.length);
    }
  });

  it("a shared item id always means the identical item", () => {
    // Ids are written into Response.itemId forever, so a collision between two
    // DIFFERENT questions would silently merge them in every analysis downstream.
    //
    // Anchor ids are shared across all four levels ON PURPOSE — that is what
    // pools their responses into one cross-level ruler (PLAN §2.2). So the
    // invariant is not "ids are unique", it is "the same id is always the same
    // question", which is what actually protects the data.
    const seen = new Map<string, { where: string; json: string }>();
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        const where = `L${form.level}${form.form}`;
        const json = JSON.stringify(item);
        const prior = seen.get(item.id);
        if (prior) {
          expect(
            json,
            `id ${item.id} means one thing in ${prior.where} and another in ${where}`,
          ).toBe(prior.json);
        } else {
          seen.set(item.id, { where, json });
        }
      }
    }
  });

  it("only anchor items are shared between levels", () => {
    const levelsById = new Map<string, Set<number>>();
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        const set = levelsById.get(item.id) ?? new Set<number>();
        set.add(form.level);
        levelsById.set(item.id, set);
      }
    }
    for (const [id, levels] of levelsById) {
      if (levels.size > 1) {
        expect(id.startsWith("anc-"), `${id} leaks across levels but is not an anchor item`).toBe(
          true,
        );
        // A partially shared anchor item would make the ruler shorter for some
        // levels than others.
        expect(levels.size, `anchor ${id} is missing from some level`).toBe(LEVELS.length);
      }
    }
  });
});

describe("forms A and B are parallel", () => {
  // This is the equating guarantee. If A is worth more than B, then whether a
  // student improved depends partly on which form they happened to get first,
  // and the counterbalancing can no longer absorb it.
  it.each(LEVELS)("level %i: A and B are worth the same", (level) => {
    expect(formPoints(getForm(level, "A"))).toBe(formPoints(getForm(level, "B")));
  });

  it.each(LEVELS)("level %i: A and B have the same blocks in the same order", (level) => {
    const a = getForm(level, "A").blocks.map((b) => b.block);
    const b = getForm(level, "B").blocks.map((b) => b.block);
    expect(a).toEqual(b);
  });

  it.each(LEVELS)("level %i: matching blocks carry equal points", (level) => {
    const a = getForm(level, "A").blocks;
    const b = getForm(level, "B").blocks;
    a.forEach((block, i) => {
      expect(blockPoints(block), `block ${block.block}`).toBe(blockPoints(b[i]));
    });
  });

  it("every level is worth the same as every other level", () => {
    // Not required for equating (the anchor does that), but a student comparing
    // notes with a friend in another level should not find a different total.
    const totals = LEVELS.map((l) => formPoints(getForm(l, "A")));
    expect(new Set(totals).size).toBe(1);
  });
});

describe("the anchor is a usable cross-level ruler", () => {
  it("A and B have the same length", () => {
    expect(ANCHOR.A.length).toBe(ANCHOR.B.length);
  });

  it("A and B are matched band for band", () => {
    // Adding an item to one array without its twin is the failure this catches:
    // the two halves would stop being interchangeable and entry/exit scores would
    // no longer sit on one scale.
    expect(ANCHOR.A.map((i) => i.band)).toEqual(ANCHOR.B.map((i) => i.band));
  });

  it("covers all four bands", () => {
    expect(new Set(ANCHOR.A.map((i) => i.band))).toEqual(
      new Set(["A1", "A2", "B1", "B2"]),
    );
  });

  it("ascends in difficulty", () => {
    const rank = { A1: 0, A2: 1, B1: 2, B2: 3 };
    for (const form of FORMS) {
      const ranks = ANCHOR[form].map((i) => rank[i.band]);
      const sorted = [...ranks].sort((x, y) => x - y);
      expect(ranks, `anchor ${form} is not in ascending order`).toEqual(sorted);
    }
  });

  it("shares no item between A and B", () => {
    const a = new Set(ANCHOR.A.map((i) => normalize(i.stem)));
    for (const item of ANCHOR.B) {
      expect(a.has(normalize(item.stem)), `${item.id} also appears in anchor A`).toBe(false);
    }
  });
});

describe("multiple choice items are answerable", () => {
  it("have a correct index in range and no duplicate options", () => {
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type !== "mcq") continue;
        expect(item.choices.length, item.id).toBeGreaterThanOrEqual(2);
        expect(item.correct, item.id).toBeGreaterThanOrEqual(0);
        expect(item.correct, item.id).toBeLessThan(item.choices.length);
        const norm = item.choices.map(normalize);
        expect(new Set(norm).size, `${item.id} has two identical options`).toBe(norm.length);
      }
    }
  });
});

describe("true/false blocks are balanced", () => {
  // An unbalanced block is free points: four items all false and a student who
  // answers "false" to everything takes the whole block.
  it.each(allForms().map((f) => [`level ${f.level} form ${f.form}`, f] as const))(
    "%s",
    (_name, form) => {
      const tf = form.blocks.find((b) => b.block === "truefalse");
      if (!tf) return;
      const trues = tf.items.filter((i) => i.type === "tf" && i.correct).length;
      const falses = tf.items.length - trues;
      expect(Math.abs(trues - falses)).toBeLessThanOrEqual(1);
    },
  );
});

describe("match blocks are answerable", () => {
  it("no duplicate left labels, and every right label distinct", () => {
    // Two rows sharing a right label turns a one-to-one match into a
    // classification question, which the UI locks incorrectly — the exact bug
    // that stranded a VillaAula lesson.
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type !== "match") continue;
        const lefts = item.pairs.map((p) => normalize(p.left));
        const rights = item.pairs.map((p) => normalize(p.right));
        expect(new Set(lefts).size, `${item.id} repeats a word`).toBe(lefts.length);
        expect(new Set(rights).size, `${item.id} repeats a definition`).toBe(rights.length);
        expect(item.points).toBe(item.pairs.length);
      }
    }
  });
});

describe("cloze blanks are answerable", () => {
  it("every answer appears in the word bank, and the bank has distractors", () => {
    // The recurring defect of the printed exams (PLAN §7): an answer missing from
    // the bank is unfindable, and a bank with no spare words hands over the last
    // blank by elimination.
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type !== "gap") continue;
        const bank = item.wordBank.map(normalize);
        const answers = item.segments
          .filter((s) => s.kind === "blank")
          .map((s) => normalize(s.answer));

        for (const a of answers) {
          expect(bank, `${item.id}: "${a}" is not in the word bank`).toContain(a);
        }
        expect(new Set(bank).size, `${item.id} repeats a bank entry`).toBe(bank.length);
        expect(
          bank.length,
          `${item.id}: the bank has no distractors, so the last blank is free`,
        ).toBeGreaterThan(answers.length);
        expect(item.points).toBe(answers.length);
      }
    }
  });

  it("blanks are numbered 1..n in order", () => {
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type !== "gap") continue;
        const ns = item.segments.filter((s) => s.kind === "blank").map((s) => s.n);
        expect(ns).toEqual(ns.map((_, i) => i + 1));
      }
    }
  });
});

describe("the blueprint total holds", () => {
  // The reconciliation of PLAN §3.2 (settled with Carlos, 2026-07-31): listening
  // was AUTHORED rather than deleted, so the instrument is 37 points as designed.
  //
  // This number is asserted, not documented, because it is the one value that
  // cannot change once a student has sat down: an instrument whose maximum
  // differs between the entry and the exit window cannot compare its own two
  // windows, and the gain score — the entire point of Umbral — stops meaning
  // anything. If this test fails, the answer is almost never "update the number".
  it("every form is worth exactly 37 points", () => {
    for (const form of allForms()) {
      expect(formPoints(form), `level ${form.level} form ${form.form}`).toBe(37);
    }
  });

  it("every form carries all eight blocks in blueprint order", () => {
    const expected = [
      "anchor",
      "listening",
      "grammar",
      "truefalse",
      "match",
      "gapfill",
      "reading",
      "speaking",
    ];
    for (const form of allForms()) {
      expect(
        form.blocks.map((b) => b.block),
        `level ${form.level} form ${form.form}`,
      ).toEqual(expected);
    }
  });
});

describe("listening is answerable", () => {
  it("every form has a 3-item, 3-point listening block", () => {
    for (const form of allForms()) {
      const block = form.blocks.find((b) => b.block === "listening");
      expect(block, `level ${form.level} form ${form.form} has no listening`).toBeDefined();
      expect(block!.items.length).toBe(3);
      expect(blockPoints(block!)).toBe(3);
    }
  });

  it("every clip referenced by an item exists on disk and contains audio", () => {
    // The failure this catches actually happened while authoring: edge-tts
    // creates the output file and THEN raises, so a throttled run left a 0-byte
    // MP3 behind. A missing file is obvious in dev; a silent one is not, and it
    // would reach a student as an unanswerable question.
    for (const form of allForms()) {
      const block = form.blocks.find((b) => b.block === "listening");
      for (const item of block?.items ?? []) {
        expect(item.audio, `${item.id} has no clip`).toBeDefined();
        const file = join(process.cwd(), "public", item.audio!.src);
        expect(existsSync(file), `${item.id}: ${item.audio!.src} is missing`).toBe(true);
        expect(
          statSync(file).size,
          `${item.id}: ${item.audio!.src} is too small to be speech`,
        ).toBeGreaterThan(4096);
      }
    }
  });

  it("every clip has a transcript, and it never reaches the student", () => {
    // The transcript is the answer key for a listening item. It is kept in the
    // bank so the audio and the key come from one place, and `toClientStep` in
    // prueba/page.tsx is what keeps it server-side — that boundary is tested in
    // steps/prueba, this only guarantees there is something to protect.
    for (const { spec } of allListeningSpecs()) {
      expect(spec.transcript.trim().length, `${spec.id} has an empty transcript`).toBeGreaterThan(0);
    }
  });

  it("slot k uses the same voice on form A and form B", () => {
    // Form-difficulty parity. If slot 2 were a fast speaker on A and a slow one
    // on B, students would sit measurably different instruments and the
    // counterbalancing could no longer absorb it — the same reasoning that makes
    // A and B equal in points.
    for (const level of LEVELS) {
      const specs = allListeningSpecs().filter((s) => s.level === level);
      for (let slot = 0; slot < 3; slot++) {
        const [a, b] = (["A", "B"] as FormId[]).map(
          (f) => specs.find((s) => s.form === f && s.slot === slot)!,
        );
        const voiceOf = (slotIndex: number) => LISTENING_VOICES[slotIndex % LISTENING_VOICES.length];
        expect(voiceOf(a.slot), `level ${level} slot ${slot}`).toBe(voiceOf(b.slot));
      }
    }
  });

  it("A and B share no transcript", () => {
    const a = new Set(
      allListeningSpecs().filter((s) => s.form === "A").map((s) => normalize(s.spec.transcript)),
    );
    for (const { spec, form } of allListeningSpecs()) {
      if (form !== "B") continue;
      expect(a.has(normalize(spec.transcript)), `${spec.id} also appears on form A`).toBe(false);
    }
  });

  it("the question alone does not give the answer away", () => {
    // A distractor that never appears in the clip's world is one a student can
    // eliminate without listening, which turns a listening item into a general
    // knowledge item. This is the weakest of these tests — it catches a lazy
    // distractor, not a subtly implausible one — but it is the defect class that
    // silently inflates a listening score.
    for (const { spec } of allListeningSpecs()) {
      expect(spec.choices.length, `${spec.id}`).toBe(3);
      const norm = spec.choices.map(normalize);
      expect(new Set(norm).size, `${spec.id} repeats an option`).toBe(norm.length);
      expect(spec.correct).toBeGreaterThanOrEqual(0);
      expect(spec.correct).toBeLessThan(spec.choices.length);
    }
  });

  it("the correct option is not always in the same position", () => {
    // The inherited defect, checked in the one block with no printed ancestor:
    // `english_test_generator` shipped four levels where option `c` was correct
    // ZERO times. The per-attempt shuffle already neutralises this at serve time,
    // so this is a second belt on the authored data itself.
    const positions = new Set(allListeningSpecs().map((s) => s.spec.correct));
    expect(positions.size, "every listening answer is authored in the same slot").toBeGreaterThan(1);
  });
});

describe("open and speaking items can be answered correctly", () => {
  it("carry at least one accepted answer (speaking may be open-ended)", () => {
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type === "open") {
          expect(item.accepted.length, `${item.id} accepts nothing`).toBeGreaterThan(0);
        }
        if (item.type === "speaking") {
          expect(item.maxSeconds, item.id).toBeGreaterThan(0);
          // A 20s cap is the quota control (PLAN §7); a longer one would blow the
          // per-attempt Gemini ceiling.
          expect(item.maxSeconds, item.id).toBeLessThanOrEqual(20);
        }
      }
    }
  });

  it("every speaking item is graded by the SAME rule on both forms", () => {
    // The bug this exists for (found 2026-07-31, fixed in tools/export_bank.py):
    // `accepted` was populated from the CLAVE sample when the source row had one.
    // Only the EXAM bank rows do, so form A demanded a verbatim match — "I am
    // from Chihuahua." — while form B, built from the Guía bank, accepted any
    // intelligible answer. Two of 37 points were therefore near-impossible on one
    // form and free on the other.
    //
    // That is not a content nit. Under counterbalancing an AB student meets the
    // hard version at entry and the free one at exit, and a BA student the
    // reverse, so the defect pushes the GAIN SCORE in opposite directions for the
    // two halves of the cohort — the one quantity this whole instrument exists to
    // produce. Parallel forms only cancel difficulty if the grading rule is
    // identical, so the rule itself is asserted here, not just the point count.
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type !== "speaking") continue;
        expect(
          item.accepted,
          `${item.id} has accepted answers, so it grades more strictly than its twin`,
        ).toEqual([]);
      }
    }
  });

  it("a spoken answer is scored on intelligibility, not on exact wording", () => {
    // Pins the consequence of the rule above, so that "empty accepted" cannot be
    // quietly reinterpreted later. Real transcripts from the live smoke test:
    // Gemini returned "I'm 20 years old" and "I'm twenty years old" for the SAME
    // clip on different calls, so any exact-match rule would score the same
    // student differently depending on which way the model rendered a number.
    for (const form of allForms()) {
      for (const item of itemsOf(form)) {
        if (item.type !== "speaking") continue;
        for (const spoken of ["I am from Delicias", "im from delicias", "I'm 20 years old"]) {
          expect(gradeItem(item, { kind: "speaking", transcript: spoken }), item.id).toBe(1);
        }
        // A dead microphone still scores 0 — every item is graded (PLAN §2.4).
        expect(gradeItem(item, { kind: "speaking", transcript: "" }), item.id).toBe(0);
        expect(gradeItem(item, null), item.id).toBe(0);
      }
    }
  });
});
