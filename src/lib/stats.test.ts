import { describe as suite, expect, it } from "vitest";
import { correlation, describe, fmt1, groupBy, histogram, pct } from "./stats";

suite("describe", () => {
  it("computes mean, median, min and max", () => {
    const s = describe([10, 20, 30, 40]);
    expect(s.n).toBe(4);
    expect(s.mean).toBe(25);
    expect(s.median).toBe(25); // even n -> mean of the middle two
    expect(s.min).toBe(10);
    expect(s.max).toBe(40);
  });

  it("takes the middle value for an odd n", () => {
    expect(describe([5, 1, 3]).median).toBe(3);
  });

  it("does not depend on input order", () => {
    expect(describe([3, 1, 2])).toEqual(describe([1, 2, 3]));
  });

  it("uses the SAMPLE standard deviation (n−1)", () => {
    // [2,4,4,4,5,5,7,9]: population SD = 2, sample SD = 2.13809…
    // The population formula is the classic textbook default and would understate
    // spread in every group table on the dashboard.
    const s = describe([2, 4, 4, 4, 5, 5, 7, 9]);
    expect(s.sd).toBeCloseTo(2.13809, 4);
    expect(s.sd).not.toBeCloseTo(2, 4);
  });

  it("reports no spread as null, never as zero, for a single student", () => {
    // "0" would read as "everyone scored identically" instead of "we can't say".
    const s = describe([42]);
    expect(s.n).toBe(1);
    expect(s.mean).toBe(42);
    expect(s.sd).toBeNull();
  });

  it("is empty rather than NaN for no data", () => {
    const s = describe([]);
    expect(s.n).toBe(0);
    expect(s.mean).toBeNull();
    expect(s.median).toBeNull();
  });

  it("ignores non-finite values instead of poisoning the mean", () => {
    // A null maxTotal upstream yields NaN; one of those would turn an entire
    // group's mean into NaN and quietly blank a row.
    expect(describe([10, NaN, 20]).mean).toBe(15);
  });
});

suite("pct", () => {
  it("divides by the attempt's own max", () => {
    expect(pct(17, 34)).toBe(50);
    expect(pct(17, 37)).toBeCloseTo(45.946, 3);
  });

  it("refuses to guess a missing denominator", () => {
    // An in-progress attempt has no totals yet. Substituting a constant here
    // would rescale historical attempts taken when the instrument was 34 points.
    expect(pct(null, 37)).toBeNull();
    expect(pct(10, null)).toBeNull();
    expect(pct(10, 0)).toBeNull();
  });
});

suite("histogram", () => {
  it("puts a perfect score in the top bin, not off the end", () => {
    const bins = histogram([100], 10);
    expect(bins[9]).toBe(1);
    expect(bins.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("uses half-open bins so a boundary lands in the higher one", () => {
    expect(histogram([10], 10)[1]).toBe(1);
    expect(histogram([9.99], 10)[0]).toBe(1);
  });

  it("counts every value exactly once", () => {
    const values = [0, 5, 12, 33, 49, 50, 71, 88, 99, 100];
    expect(histogram(values, 10).reduce((a, b) => a + b, 0)).toBe(values.length);
  });
});

suite("groupBy", () => {
  it("preserves first-seen order of keys", () => {
    const g = groupBy([{ k: "b" }, { k: "a" }, { k: "b" }], (x) => x.k);
    expect([...g.keys()]).toEqual(["b", "a"]);
    expect(g.get("b")).toHaveLength(2);
  });
});

suite("fmt1", () => {
  it("never prints null or NaN into a table", () => {
    expect(fmt1(null)).toBe("—");
    expect(fmt1(NaN)).toBe("—");
    expect(fmt1(45.94)).toBe("45.9");
  });
});

suite("correlation", () => {
  it("is 1 for a perfect positive relationship", () => {
    expect(correlation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 10);
  });

  it("is −1 for a perfect inverse relationship", () => {
    expect(correlation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 10);
  });

  it("matches a hand-computed value", () => {
    // x̄ = 3, ȳ = 4.6 → Sxy = 12, Sxx = 10, Syy = 19.2
    // r = 12 / √192 = 0.866025… (= √3/2)
    expect(correlation([1, 2, 3, 4, 5], [2, 4, 5, 4, 8])).toBeCloseTo(Math.sqrt(3) / 2, 10);
  });

  it("is NULL, not zero, when one side never varies", () => {
    // An item everybody got right correlates with nothing — that is "we cannot
    // tell", and printing 0 would report it as "this item does not discriminate".
    expect(correlation([1, 1, 1, 1], [1, 2, 3, 4])).toBeNull();
    expect(correlation([1, 2, 3, 4], [5, 5, 5, 5])).toBeNull();
  });

  it("refuses a sample too small to mean anything", () => {
    expect(correlation([1, 2], [3, 4])).toBeNull();
  });

  it("does not depend on scale or offset", () => {
    const xs = [3, 1, 4, 1, 5, 9];
    const ys = [2, 7, 1, 8, 2, 8];
    const a = correlation(xs, ys)!;
    const b = correlation(xs.map((x) => x * 10 + 3), ys.map((y) => y * 2 - 7))!;
    expect(a).toBeCloseTo(b, 10);
  });
});
