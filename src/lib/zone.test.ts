import { readFileSync } from "node:fs";
import { describe as suite, expect, it } from "vitest";
import { endOfDay, formatDate, startOfDay, zonedDate, ZONE } from "./zone";
import { windowIsOpen } from "./attempt";

suite("zone", () => {
  it("is pinned to one city, not to wherever the code runs", () => {
    // Replit runs in UTC and this laptop does not. A window edited in one place
    // and read in the other must land on the same calendar day.
    expect(ZONE).toBe("America/Chihuahua");
  });

  it("turns a calendar day into the instant it begins, six hours behind UTC", () => {
    // Chihuahua is UTC−6 year round since it stopped observing DST in 2022.
    expect(startOfDay("2026-08-10")!.toISOString()).toBe("2026-08-10T06:00:00.000Z");
  });

  it("holds in January too, where a DST-observing zone would differ", () => {
    expect(startOfDay("2026-01-15")!.toISOString()).toBe("2026-01-15T06:00:00.000Z");
  });

  it("closes at the END of the closing day, not at its start", () => {
    // ⚠️ `windowIsOpen` uses `now <= closesAt`. Midnight here would shut the
    // window a whole day early, on exactly the students who leave it to the last
    // day.
    const close = endOfDay("2026-10-03")!;
    expect(close.toISOString()).toBe("2026-10-04T05:59:59.999Z");
  });

  it("keeps a window open all through its last local day", () => {
    const w = {
      id: "w",
      phase: "entry",
      status: "open",
      opensAt: startOfDay("2026-08-10")!,
      closesAt: endOfDay("2026-10-03")!,
    };
    // 23:30 in Chihuahua on the closing day — already the 4th in UTC.
    expect(windowIsOpen(w, new Date("2026-10-04T05:30:00Z"))).toBe(true);
    // Ten past midnight local, the day after: shut.
    expect(windowIsOpen(w, new Date("2026-10-04T06:10:00Z"))).toBe(false);
    // Just before it opens, local.
    expect(windowIsOpen(w, new Date("2026-08-10T05:59:00Z"))).toBe(false);
  });

  it("round-trips a date through the instant and back", () => {
    for (const iso of ["2026-01-01", "2026-06-15", "2026-08-10", "2026-12-31"]) {
      expect(zonedDate(startOfDay(iso)!)).toBe(iso);
      expect(zonedDate(endOfDay(iso)!)).toBe(iso);
    }
  });

  it("reads an instant back as the day it falls on LOCALLY", () => {
    // 02:00 UTC is still the previous evening in Chihuahua. Formatting this in
    // UTC — which is what a Replit server does by default — would show the wrong
    // day in the admin panel.
    expect(zonedDate(new Date("2026-08-11T02:00:00Z"))).toBe("2026-08-10");
    expect(zonedDate(new Date("2026-08-11T06:00:00Z"))).toBe("2026-08-11");
  });

  it("rejects anything that is not a plain calendar date", () => {
    expect(startOfDay("")).toBeNull();
    expect(startOfDay("10/08/2026")).toBeNull();
    expect(startOfDay("2026-08-10T00:00")).toBeNull();
    expect(startOfDay("mañana")).toBeNull();
    expect(endOfDay("nope")).toBeNull();
  });

  it("formats for display in Chihuahua, never in the server's zone", () => {
    expect(formatDate(new Date("2026-08-11T02:00:00Z"))).toContain("10");
  });

  it("agrees with the offset the seed script hardcodes", () => {
    // `tools/seed.mjs` is plain node and cannot import this module, so it spells
    // the offset out. If the two ever disagree, a freshly seeded window opens on
    // a different day than the admin panel shows — which is precisely the bug
    // this file exists to prevent, so the duplication gets a guard rather than a
    // comment asking someone to remember.
    const seed = readFileSync(
      new URL("../../tools/seed.mjs", import.meta.url),
      "utf8",
    );
    const match = seed.match(/CHIHUAHUA_OFFSET = "([+-]\d{2}:\d{2})"/);
    expect(match, "seed.mjs must declare CHIHUAHUA_OFFSET").not.toBeNull();

    const viaSeed = new Date(`2026-08-10T00:00:00.000${match![1]}`);
    expect(viaSeed.toISOString()).toBe(startOfDay("2026-08-10")!.toISOString());
  });
});
