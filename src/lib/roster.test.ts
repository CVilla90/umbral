import { describe, expect, it } from "vitest";
import { parseRoster } from "./roster";

describe("parseRoster", () => {
  it("reads a plain comma list with a header", () => {
    const r = parseRoster("Matrícula,Nombre,Nivel,Grupo\n349021,Ana Ramírez,2,B\n349022,Luis Soto,2,B");
    expect(r.headerSkipped).toBe(true);
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0]).toEqual({
      matricula: "349021",
      fullName: "Ana Ramírez",
      englishLevel: 2,
      group: "B",
    });
    expect(r.errors).toHaveLength(0);
  });

  it("handles a Spanish-locale Excel export (semicolons)", () => {
    // Spanish Excel uses ; because the comma is its decimal separator. Assuming
    // a comma would parse this whole file as one column per row.
    const r = parseRoster("349021;Ana Ramírez;2;B");
    expect(r.delimiter).toBe(";");
    expect(r.rows[0].matricula).toBe("349021");
    expect(r.rows[0].group).toBe("B");
  });

  it("strips a UTF-8 BOM instead of gluing it to the first matrícula", () => {
    const r = parseRoster("﻿349021,Ana,2,B");
    expect(r.rows[0].matricula).toBe("349021");
  });

  it("keeps a quoted name that contains the delimiter", () => {
    const r = parseRoster('349021,"Ramírez Soto, Ana",2,B');
    expect(r.rows[0].fullName).toBe("Ramírez Soto, Ana");
    expect(r.rows[0].englishLevel).toBe(2);
  });

  it("accepts a three-column list with no names", () => {
    const r = parseRoster("349021,2,B\n349022,3,A");
    expect(r.rows).toHaveLength(2);
    expect(r.rows[0].fullName).toBeNull();
    expect(r.rows[1].englishLevel).toBe(3);
  });

  it("normalizes matrículas the same way the matcher does", () => {
    // Typed on phones, transcribed by staff: "a-349 021" must match "A349021".
    const r = parseRoster("a-349 021,Ana,2,b");
    expect(r.rows[0].matricula).toBe("A349021");
    expect(r.rows[0].group).toBe("B");
  });

  it("REPORTS bad lines instead of dropping them", () => {
    // A silently dropped student becomes a false "sin empezar" and gets chased
    // for something they actually did.
    const r = parseRoster("349021,Ana,9,B\n349022,Luis,2,B\n,Sin matrícula,2,B");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(2);
    expect(r.errors[0]).toMatchObject({ line: 1, reason: expect.stringContaining("nivel") });
    expect(r.errors[1]).toMatchObject({ line: 3, reason: "matrícula vacía" });
  });

  it("surfaces duplicates and keeps the last one", () => {
    const r = parseRoster("349021,Ana,2,B\n349021,Ana,3,A");
    expect(r.rows).toHaveLength(1);
    expect(r.rows[0].englishLevel).toBe(3);
    expect(r.duplicates).toEqual(["349021"]);
  });

  it("does not mistake a student for a header", () => {
    // A first line that looks header-ish but carries a real level is data.
    const r = parseRoster("349021,Nivel Ramírez,2,B");
    expect(r.headerSkipped).toBe(false);
    expect(r.rows).toHaveLength(1);
  });

  it("ignores blank lines and trailing newlines", () => {
    const r = parseRoster("349021,Ana,2,B\n\n\n");
    expect(r.rows).toHaveLength(1);
    expect(r.errors).toHaveLength(0);
  });

  it("returns nothing rather than throwing on empty input", () => {
    const r = parseRoster("");
    expect(r.rows).toHaveLength(0);
    expect(r.errors).toHaveLength(0);
  });
});
