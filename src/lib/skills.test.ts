import { describe, it, expect } from "vitest";
import {
  breakdownBySkill,
  isIndividuallyReportable,
  skillOf,
  skillOfBlock,
  skillWeights,
  SKILLS,
  type ResponseLike,
} from "./skills";
import { allForms } from "@/content/forms";
import type { Block } from "./types";

const r = (block: string, points: number, maxPoints: number, skipped = false): ResponseLike => ({
  block,
  points,
  maxPoints,
  skipped,
});

describe("every block maps to a skill", () => {
  it("covers every block the bank actually uses", () => {
    // A new block type added without a mapping would silently vanish from every
    // skill breakdown rather than failing loudly.
    const used = new Set<Block>();
    for (const form of allForms()) for (const b of form.blocks) used.add(b.block);
    for (const block of used) {
      expect(SKILLS, `block "${block}" has no skill`).toContain(skillOfBlock(block));
    }
  });

  it("puts recognition under use, not writing", () => {
    // The category error this whole taxonomy exists to avoid: multiple choice and
    // true/false are not written production, and letting them into `writing`
    // would swamp the 5 points that genuinely are.
    expect(skillOfBlock("grammar")).toBe("use");
    expect(skillOfBlock("truefalse")).toBe("use");
    expect(skillOfBlock("match")).toBe("use");
    expect(skillOfBlock("gapfill")).toBe("writing");
  });

  it("lets an item override its block", () => {
    expect(skillOf("reading")).toBe("reading");
    expect(skillOf("reading", "writing")).toBe("writing");
  });
});

describe("breakdownBySkill", () => {
  const responses = [
    r("grammar", 4, 6),
    r("truefalse", 2, 4),
    r("match", 3, 6),
    r("gapfill", 5, 5),
    r("reading", 1, 3),
    r("speaking", 0, 2, true),
    r("anchor", 3, 8),
  ];

  it("sums points per skill", () => {
    const by = Object.fromEntries(breakdownBySkill(responses).map((s) => [s.skill, s]));
    expect(by.use.points).toBe(9); // 4 + 2 + 3
    expect(by.use.max).toBe(16);
    expect(by.writing.points).toBe(5);
    expect(by.reading.points).toBe(1);
  });

  it("excludes the anchor by default", () => {
    // The anchor is the cross-level ruler; mixing its shared items into a
    // level-specific subscore makes that subscore mean neither thing.
    const without = breakdownBySkill(responses).find((s) => s.skill === "use")!;
    const withIt = breakdownBySkill(responses, { includeAnchor: true }).find(
      (s) => s.skill === "use",
    )!;
    expect(without.max).toBe(16);
    expect(withIt.max).toBe(24);
  });

  it("reports an unmeasured skill as null, not zero", () => {
    // Listening has no clips yet. "0 %" would read as "the cohort scored nothing"
    // — the opposite of "this was never asked".
    const listening = breakdownBySkill(responses).find((s) => s.skill === "listening")!;
    expect(listening.pct).toBeNull();
    expect(listening.items).toBe(0);
  });

  it("distinguishes a zero score from an absent one", () => {
    const speaking = breakdownBySkill(responses).find((s) => s.skill === "speaking")!;
    expect(speaking.pct).toBe(0);
    expect(speaking.items).toBe(1);
    expect(speaking.skipped).toBe(1);
  });

  it("always returns every skill, in a stable order", () => {
    expect(breakdownBySkill([]).map((s) => s.skill)).toEqual(SKILLS);
  });
});

describe("skillWeights exposes how thin each subscore is", () => {
  const items = allForms()
    .find((f) => f.level === 2 && f.form === "A")!
    .blocks.flatMap((b) => b.items.map((i) => ({ block: b.block, points: i.points })));

  it("matches the built blueprint", () => {
    const w = skillWeights(items);
    expect(w.use).toBe(16); // grammar 6 + tf 4 + match 6
    expect(w.writing).toBe(5);
    expect(w.reading).toBe(3);
    expect(w.speaking).toBe(2);
    // Authored 2026-07-31 (was 0). This is the number that took the instrument
    // from 34 points to the blueprint's 37 and gave the breakdown its fifth
    // skill — see the reconciliation in bank.test.ts.
    expect(w.listening).toBe(3);
    // The five subscores account for every non-anchor point, with nothing
    // silently unmapped: 16 + 5 + 3 + 2 + 3 = 29, and 29 + 8 anchor = 37.
    expect(Object.values(w).reduce((a, b) => a + b, 0)).toBe(29);
  });

  it("marks the four real skills cohort-only, and Use of English reportable", () => {
    // The guard rail for the dashboard. If a future rebalancing changes which
    // subscores carry enough evidence for an individual verdict, this test fails
    // and the decision gets made deliberately instead of by accident.
    const scores = Object.fromEntries(
      breakdownBySkill(
        items.map((i) => ({ block: i.block, points: i.points, maxPoints: i.points })),
      ).map((s) => [s.skill, s]),
    );

    // 16 points of recognition — enough to say something about one person.
    expect(isIndividuallyReportable(scores.use)).toBe(true);

    // 5, 3 and 2 points. A single student's number here is noise; the cohort mean
    // over ~100 students is not.
    for (const skill of ["writing", "reading", "speaking", "listening"] as const) {
      expect(
        isIndividuallyReportable(scores[skill]),
        `${skill} has ${scores[skill].max} points`,
      ).toBe(false);
    }
  });
});
