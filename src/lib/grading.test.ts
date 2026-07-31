import { describe, it, expect } from "vitest";
import { normalize, gradeOpen, gradeMatch, gradeGap, gradeItem } from "./grading";
import { optionOrder, itemSeed, shuffled, displayIndexOf } from "./shuffle";
import type { GapItem, MatchItem, McqItem, SpeakingItem } from "./types";

describe("normalize", () => {
  it("folds case and collapses whitespace", () => {
    expect(normalize("  Hello   World ")).toBe("hello world");
  });

  it("strips accents", () => {
    expect(normalize("Café ÁÉÍÓÚ")).toBe("cafe aeiou");
  });

  it("treats every apostrophe the same", () => {
    // Carlos's actual requirement: a Spanish phone keyboard offers ’ (U+2019),
    // a Spanish-first typist reaches for ´, and autocapitalisation adds a capital.
    // None of those is an English mistake, so none may cost a point.
    const forms = ["don't", "don’t", "don´t", "Don't", "DON'T", "dont"];
    for (const f of forms) expect(normalize(f)).toBe("dont");
  });

  it("does not merge genuinely different answers", () => {
    expect(normalize("there is")).not.toBe(normalize("there are"));
  });
});

describe("gradeOpen", () => {
  it("accepts a normalized match", () => {
    expect(gradeOpen("  There Is ", ["there is"])).toBe(true);
  });

  it("accepts a listed contraction", () => {
    expect(gradeOpen("there's", ["there is", "there's"])).toBe(true);
  });

  it("rejects an empty answer even when something is accepted", () => {
    expect(gradeOpen("   ", ["anything"])).toBe(false);
  });

  it("rejects a wrong answer", () => {
    expect(gradeOpen("there are", ["there is"])).toBe(false);
  });
});

describe("gradeMatch scores per row", () => {
  const item: MatchItem = {
    id: "m",
    type: "match",
    points: 3,
    pairs: [
      { left: "eraser", right: "removes a mistake" },
      { left: "backpack", right: "carries your books" },
      { left: "nurse", right: "takes care of patients" },
    ],
  };

  it("gives partial credit", () => {
    const answer = {
      eraser: "removes a mistake",
      backpack: "takes care of patients",
      nurse: "carries your books",
    };
    expect(gradeMatch(answer, item).points).toBe(1);
  });

  it("does not punish an unanswered row beyond its own point", () => {
    const answer = { eraser: "removes a mistake" };
    expect(gradeMatch(answer, item).points).toBe(1);
  });
});

describe("gradeGap scores per blank", () => {
  const item: GapItem = {
    id: "g",
    type: "gap",
    points: 2,
    wordBank: ["am", "is", "are"],
    segments: [
      { kind: "text", value: "I " },
      { kind: "blank", n: 1, answer: "am", accepted: ["am"] },
      { kind: "text", value: " here and she " },
      { kind: "blank", n: 2, answer: "is", accepted: ["is"] },
      { kind: "filled", value: "there" },
    ],
  };

  it("credits each correct blank", () => {
    expect(gradeGap({ "1": "am", "2": "is" }, item).points).toBe(2);
    expect(gradeGap({ "1": "am", "2": "are" }, item).points).toBe(1);
    expect(gradeGap({}, item).points).toBe(0);
  });

  it("ignores filled segments", () => {
    expect(gradeGap({ "1": "am", "2": "is", "3": "there" }, item).points).toBe(2);
  });
});

describe("gradeItem — every item is graded, blanks score zero", () => {
  const mcq: McqItem = {
    id: "q",
    type: "mcq",
    points: 1,
    stem: "s",
    choices: ["a", "b", "c"],
    correct: 2,
  };

  it("scores an unanswered item as zero rather than skipping it", () => {
    // A dead microphone or a skipped screen must still cost the point, so a
    // student who cannot record cannot reach 100 % (Carlos, 2026-07-30).
    expect(gradeItem(mcq, null)).toBe(0);
    expect(gradeItem(mcq, { kind: "mcq", value: null })).toBe(0);
  });

  it("scores a correct choice", () => {
    expect(gradeItem(mcq, { kind: "mcq", value: 2 })).toBe(1);
  });

  it("ignores a response of the wrong shape", () => {
    expect(gradeItem(mcq, { kind: "tf", value: true })).toBe(0);
  });

  const speaking: SpeakingItem = {
    id: "sp",
    type: "speaking",
    points: 1,
    stem: "Where are you from?",
    target: "to be",
    accepted: [],
    maxSeconds: 20,
  };

  it("accepts any intelligible spoken answer when nothing specific is required", () => {
    expect(gradeItem(speaking, { kind: "speaking", transcript: "I am from Chihuahua" })).toBe(1);
  });

  it("scores a missing transcript as zero", () => {
    expect(gradeItem(speaking, { kind: "speaking", transcript: null })).toBe(0);
  });
});

describe("seeded shuffling is reproducible and actually shuffles", () => {
  it("gives the same order for the same seed", () => {
    expect(optionOrder(3, 12345)).toEqual(optionOrder(3, 12345));
  });

  it("gives different orders for different seeds", () => {
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => optionOrder(3, s).join(""));
    expect(new Set(seeds).size).toBeGreaterThan(1);
  });

  it("is a permutation, never a drop or a duplicate", () => {
    for (let s = 0; s < 50; s++) {
      expect([...optionOrder(4, s)].sort()).toEqual([0, 1, 2, 3]);
    }
  });

  it("permutes each item independently from one attempt seed", () => {
    // Without mixing the item id into the seed, every item on an attempt would be
    // permuted identically and the pattern would be learnable down a row of desks.
    const attempt = 987654;
    const orders = ["q1", "q2", "q3", "q4", "q5", "q6"].map((id) =>
      optionOrder(3, itemSeed(attempt, id)).join(""),
    );
    expect(new Set(orders).size).toBeGreaterThan(1);
  });

  it("maps the authored correct index to its displayed position", () => {
    const order = optionOrder(3, 42);
    const shown = displayIndexOf(order, 2);
    expect(order[shown]).toBe(2);
  });

  it("breaks the inherited answer-letter skew", () => {
    // The defect being fixed: in the printed levels 1-3 the answer is `c` zero
    // times and `b` 59-75 % of the time. Shuffling 200 items whose authored answer
    // is ALWAYS index 1 must spread the displayed position across all three slots.
    const counts = [0, 0, 0];
    for (let i = 0; i < 200; i++) {
      const order = optionOrder(3, itemSeed(i, `item-${i}`));
      counts[displayIndexOf(order, 1)]++;
    }
    for (const c of counts) {
      expect(c, `slots came out ${counts.join("/")}`).toBeGreaterThan(200 / 6);
    }
  });

  it("leaves the source array untouched", () => {
    const src = [1, 2, 3, 4, 5];
    shuffled(src, 7);
    expect(src).toEqual([1, 2, 3, 4, 5]);
  });
});
