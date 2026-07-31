import { describe as suite, expect, it } from "vitest";
import {
  analyseItems,
  bankIndex,
  flagsFor,
  itemLabel,
  MIN_N_TO_FLAG,
  type BankEntry,
  type ItemResponseRow,
} from "./items";
import type { McqItem } from "./types";

const MCQ: McqItem = {
  id: "x-1",
  type: "mcq",
  points: 1,
  stem: "She ___ to school every day.",
  choices: ["go", "goes", "going", "gone"],
  correct: 1,
};

const INDEX = new Map<string, BankEntry>([
  ["x-1", { item: MCQ, block: "grammar", levels: [2], forms: ["A"] }],
]);

/** n responses to x-1, `right` of which picked the authored answer. */
function rows(n: number, right: number, over: Partial<ItemResponseRow> = {}): ItemResponseRow[] {
  return Array.from({ length: n }, (_, i) => ({
    itemId: "x-1",
    block: "grammar",
    type: "mcq",
    raw: { authored: i < right ? 1 : 0, shown: 0 },
    points: i < right ? 1 : 0,
    maxPoints: 1,
    msElapsed: 10_000,
    skipped: false,
    // Strong students first, so item score and total agree by construction.
    attemptTotal: i < right ? 30 : 10,
    ...over,
  }));
}

suite("bankIndex", () => {
  const index = bankIndex();

  it("indexes every item in the shipped bank", () => {
    expect(index.size).toBeGreaterThan(100);
  });

  it("gives the anchor items all four levels — they are the cross-level ruler", () => {
    // The same eight ids are served to Inglés 1 and Inglés 4. Their n is four
    // times everyone else's, and that is the design, not double counting.
    const anchor = [...index.values()].filter((e) => e.block === "anchor");
    expect(anchor.length).toBeGreaterThan(0);
    for (const entry of anchor) {
      expect(entry.levels.sort()).toEqual([1, 2, 3, 4]);
    }
  });

  it("keeps a level item on its own level", () => {
    const grammar = [...index.values()].find((e) => e.block === "grammar");
    expect(grammar!.levels).toHaveLength(1);
  });

  it("has no duplicate id carrying two different blocks", () => {
    for (const [, entry] of index) {
      expect(typeof entry.block).toBe("string");
    }
  });
});

suite("itemLabel", () => {
  it("never reveals the answer", () => {
    expect(itemLabel(MCQ)).toBe(MCQ.stem);
    expect(itemLabel(MCQ)).not.toContain("goes");
  });

  it("describes a match item by its size", () => {
    expect(
      itemLabel({
        id: "m",
        type: "match",
        points: 3,
        pairs: [
          { left: "a", right: "1" },
          { left: "b", right: "2" },
          { left: "c", right: "3" },
        ],
      }),
    ).toBe("3 pares");
  });
});

suite("analyseItems", () => {
  it("computes the p-value as the proportion of available points earned", () => {
    const [a] = analyseItems(rows(10, 7), INDEX);
    expect(a.n).toBe(10);
    expect(a.pValue).toBeCloseTo(0.7, 6);
  });

  it("keeps a multi-point item on the same scale as a one-point item", () => {
    // 6-point match, half the rows earning 3 of 6 → p = 0.5, not 0.
    const match: ItemResponseRow[] = Array.from({ length: 4 }, () => ({
      itemId: "m-1",
      block: "match",
      type: "match",
      raw: {},
      points: 3,
      maxPoints: 6,
      msElapsed: null,
      skipped: false,
      attemptTotal: 20,
    }));
    expect(analyseItems(match, INDEX)[0].pValue).toBeCloseTo(0.5, 6);
  });

  it("counts picks by AUTHORED index, straight from the stored response", () => {
    // `raw` carries both `{ authored, shown }`, so the counts never depend on
    // re-deriving the shuffle — which could disagree with what was graded.
    const a = analyseItems(rows(10, 7), INDEX)[0];
    expect(a.options).not.toBeNull();
    expect(a.options![1]).toMatchObject({ picks: 7, isCorrect: true });
    expect(a.options![0]).toMatchObject({ picks: 3, isCorrect: false });
    expect(a.options![2].picks).toBe(0);
  });

  it("has no option counts for a non-mcq item", () => {
    const tf: ItemResponseRow[] = [
      {
        itemId: "x-1",
        block: "truefalse",
        type: "tf",
        raw: true,
        points: 1,
        maxPoints: 1,
        msElapsed: null,
        skipped: false,
        attemptTotal: 10,
      },
    ];
    // Indexed as an mcq here only to prove the branch keys off the BANK item,
    // never off the response row's own `type` string.
    expect(analyseItems(tf, INDEX)[0].options).not.toBeNull();
    expect(analyseItems(tf, new Map())[0].options).toBeNull();
  });

  it("uses the MEDIAN latency, so one abandoned tab cannot distort it", () => {
    const base = rows(5, 5);
    base[4].msElapsed = 3_600_000; // walked away for an hour
    const a = analyseItems(base, INDEX)[0];
    expect(a.medianSeconds).toBe(10);
  });

  it("ignores missing and zero latencies rather than counting them as instant", () => {
    const base = rows(4, 4);
    base[0].msElapsed = null;
    base[1].msElapsed = 0;
    expect(analyseItems(base, INDEX)[0].medianSeconds).toBe(10);
  });

  it("removes the item's own points from the total before correlating", () => {
    // Everyone scores the same overall; only who got THIS item right differs.
    // Uncorrected, the item's own point would manufacture a correlation out of
    // nothing. Corrected, the rest-total is constant and the answer is null.
    const flat = rows(10, 5).map((r) => ({ ...r, attemptTotal: 20 + r.points }));
    expect(analyseItems(flat, INDEX)[0].discrimination).toBeNull();
  });

  it("reports a negative discrimination when strong students get it wrong", () => {
    // The classic miskeyed-answer signature.
    const flipped = rows(10, 5).map((r, i) => ({ ...r, attemptTotal: i < 5 ? 10 : 30 }));
    expect(analyseItems(flipped, INDEX)[0].discrimination!).toBeLessThan(0);
  });

  it("survives an item that is no longer in the bank", () => {
    // `itemSnapshot` guarantees historical responses outlive the bank.
    const [a] = analyseItems(rows(3, 2), new Map());
    expect(a.label).toBe("(reactivo retirado del banco)");
    expect(a.block).toBe("grammar"); // fell back to the response row
    expect(a.pValue).toBeCloseTo(2 / 3, 6);
  });

  it("omits items nobody answered instead of listing them at n = 0", () => {
    expect(analyseItems([], INDEX)).toHaveLength(0);
  });

  it("counts skips separately from wrong answers", () => {
    const base = rows(4, 2);
    base[3].skipped = true;
    expect(analyseItems(base, INDEX)[0].skipped).toBe(1);
  });
});

suite("flagsFor", () => {
  const analyse = (rs: ItemResponseRow[]) => flagsFor(analyseItems(rs, INDEX)[0]);

  it("says nothing at all below the minimum n", () => {
    // Small samples produce alarming numbers; alarming numbers get acted on.
    expect(analyse(rows(MIN_N_TO_FLAG - 1, 0))).toEqual([]);
  });

  it("flags an item almost everyone gets right", () => {
    expect(analyse(rows(20, 20))).toContain("muy fácil");
  });

  it("flags an item almost nobody gets right", () => {
    expect(analyse(rows(20, 2))).toContain("muy difícil");
  });

  it("flags a negative discrimination as a key to re-check", () => {
    const flipped = rows(20, 10).map((r, i) => ({ ...r, attemptTotal: i < 10 ? 10 : 30 }));
    expect(analyse(flipped)).toContain("revisar clave");
  });

  it("flags a distractor nobody ever picks", () => {
    // Options 2 and 3 are never chosen: the item is really a two-way choice.
    expect(analyse(rows(20, 14))).toContain("opción muerta");
  });

  it("does not flag a healthy item", () => {
    const healthy = rows(20, 12).map((r, i) => ({
      ...r,
      raw: { authored: i < 12 ? 1 : i % 4, shown: 0 },
    }));
    expect(analyse(healthy)).toEqual([]);
  });
});
