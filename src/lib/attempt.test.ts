import { describe, it, expect } from "vitest";
import {
  activeWindow,
  daysBetween,
  formFor,
  gain,
  isStale,
  pct,
  randomFormOrder,
  windowClosedReason,
  windowIsOpen,
  type WindowLike,
} from "./attempt";

const win = (over: Partial<WindowLike> = {}): WindowLike => ({
  id: "w",
  phase: "entry",
  opensAt: new Date("2026-08-10T00:00:00Z"),
  closesAt: new Date("2026-10-03T23:59:59Z"),
  status: "open",
  ...over,
});

describe("window availability needs schedule AND switch", () => {
  it("is open inside the dates when the status says open", () => {
    expect(windowIsOpen(win(), new Date("2026-09-01T12:00:00Z"))).toBe(true);
  });

  it("is shut on the day before it opens", () => {
    expect(windowIsOpen(win(), new Date("2026-08-09T23:59:00Z"))).toBe(false);
  });

  it("is still open on the last afternoon", () => {
    // The close date is the END of that day. If this ever regresses, every
    // student who tries on the final afternoon is silently turned away.
    expect(windowIsOpen(win(), new Date("2026-10-03T18:00:00Z"))).toBe(true);
  });

  it("is shut when paused, even mid-schedule", () => {
    expect(windowIsOpen(win({ status: "paused" }), new Date("2026-09-01T12:00:00Z"))).toBe(false);
  });

  it("reports why it is shut", () => {
    expect(windowClosedReason(win(), new Date("2026-08-01T00:00:00Z"))).toBe("too-early");
    expect(windowClosedReason(win(), new Date("2026-11-01T00:00:00Z"))).toBe("too-late");
    expect(windowClosedReason(win({ status: "paused" }), new Date("2026-09-01T00:00:00Z"))).toBe(
      "paused",
    );
    expect(windowClosedReason(null)).toBe("no-window");
    expect(windowClosedReason(win(), new Date("2026-09-01T00:00:00Z"))).toBeNull();
  });
});

describe("activeWindow", () => {
  const entry = win({ id: "e", phase: "entry" });
  const exit = win({
    id: "x",
    phase: "exit",
    opensAt: new Date("2026-10-04T00:00:00Z"),
    closesAt: new Date("2026-11-27T23:59:59Z"),
  });

  it("picks the one that is open", () => {
    expect(activeWindow([entry, exit], new Date("2026-11-01T00:00:00Z"))?.id).toBe("x");
  });

  it("prefers entry if both are somehow open", () => {
    // An exit score with no baseline is the one result the instrument cannot use.
    const both = [exit, win({ id: "e", closesAt: new Date("2026-11-27T23:59:59Z") })];
    expect(activeWindow(both, new Date("2026-11-01T00:00:00Z"))?.phase).toBe("entry");
  });

  it("returns null between semesters", () => {
    expect(activeWindow([entry, exit], new Date("2026-12-20T00:00:00Z"))).toBeNull();
  });
});

describe("counterbalanced form assignment", () => {
  it("serves the complement at exit", () => {
    expect(formFor("AB", "entry")).toBe("A");
    expect(formFor("AB", "exit")).toBe("B");
    expect(formFor("BA", "entry")).toBe("B");
    expect(formFor("BA", "exit")).toBe("A");
  });

  it("never serves the same form twice to one student", () => {
    for (const order of ["AB", "BA"]) {
      expect(formFor(order, "entry")).not.toBe(formFor(order, "exit"));
    }
  });

  it("falls back to AB rather than throwing on a corrupt value", () => {
    // A student mid-attempt must never hit a 500 because of a bad enum.
    expect(formFor("", "entry")).toBe("A");
  });

  it("assigns both orders over many enrollments", () => {
    // If this ever became constant, the whole cohort would meet form A first and
    // form-difficulty would stop cancelling — the counterbalancing would be
    // decorative.
    const seen = new Set(Array.from({ length: 200 }, randomFormOrder));
    expect(seen).toEqual(new Set(["AB", "BA"]));
  });
});

describe("derived numbers", () => {
  it("computes percentages on read", () => {
    expect(pct(26, 37)).toBe(70.3);
    expect(pct(0, 37)).toBe(0);
  });

  it("returns null rather than zero when a score is missing", () => {
    // A missing entry must never look like a score of zero, or every
    // single-window student would appear to have collapsed.
    expect(pct(null, 37)).toBeNull();
    expect(gain(null, 80)).toBeNull();
    expect(gain(60, null)).toBeNull();
  });

  it("computes gain in both directions", () => {
    expect(gain(60, 80)).toBe(20);
    expect(gain(80, 60)).toBe(-20);
  });

  it("measures the gap between sittings", () => {
    expect(
      daysBetween(new Date("2026-08-21T10:00:00Z"), new Date("2026-11-06T10:00:00Z")),
    ).toBe(77);
    expect(daysBetween(null, new Date())).toBeNull();
  });
});

describe("stale attempts", () => {
  it("leaves a recent attempt alone", () => {
    const now = new Date("2026-09-10T00:00:00Z");
    expect(isStale(new Date("2026-09-08T00:00:00Z"), now)).toBe(false);
  });

  it("closes one abandoned two weeks ago", () => {
    const now = new Date("2026-09-30T00:00:00Z");
    expect(isStale(new Date("2026-09-10T00:00:00Z"), now)).toBe(true);
  });
});
