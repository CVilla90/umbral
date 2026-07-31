import { describe as suite, expect, it } from "vitest";
import {
  formEffect,
  gainBy,
  gainDirection,
  pairCoverage,
  pairedCsv,
  pairedFilename,
  pairedOnly,
  pairedRows,
  PAIRED_COLUMNS,
  type AttemptScore,
  type PairedInput,
} from "./progress";

const D = (iso: string) => new Date(iso);

function attempt(over: Partial<AttemptScore> = {}): AttemptScore {
  return {
    form: "A",
    totalRaw: 20,
    maxTotal: 37,
    anchorRaw: 4,
    maxAnchor: 8,
    levelRaw: 16,
    maxLevel: 29,
    submittedAt: D("2026-08-12T10:00:00Z"),
    durationMs: 1_200_000,
    ...over,
  };
}

function student(over: Partial<PairedInput> = {}): PairedInput {
  return {
    matricula: "349021",
    fullName: "Ana Ramírez",
    email: "ana@uach.mx",
    englishLevel: 2,
    group: "B",
    academicSemester: 3,
    professorName: "Ramírez",
    formOrder: "AB",
    entry: attempt(),
    exit: attempt({ form: "B", totalRaw: 26, submittedAt: D("2026-11-20T10:00:00Z") }),
    ...over,
  };
}

suite("pairedRows", () => {
  it("computes gain from the two percentages it prints", () => {
    // The whole point: an analyst subtracting the two columns in the CSV must get
    // the third column back. Computing gain from unrounded values would leave the
    // file disagreeing with itself by a tenth here and there.
    const [row] = pairedRows([student()]);
    expect(row.entradaPct).toBe(54.1);
    expect(row.salidaPct).toBe(70.3);
    expect(row.avance).toBe(16.2);
    expect(row.salidaPct! - row.entradaPct!).toBeCloseTo(row.avance!, 10);
  });

  it("leaves gain NULL when only one window exists — never zero", () => {
    // Zero would sit in the mean saying "this student learned nothing", which is
    // a claim about a measurement that was never taken.
    const [onlyEntry] = pairedRows([student({ exit: null })]);
    expect(onlyEntry.avance).toBeNull();
    expect(onlyEntry.estado).toBe("solo entrada");
    expect(onlyEntry.salidaPct).toBeNull();

    const [onlyExit] = pairedRows([student({ entry: null })]);
    expect(onlyExit.avance).toBeNull();
    expect(onlyExit.estado).toBe("solo salida");

    const [neither] = pairedRows([student({ entry: null, exit: null })]);
    expect(neither.avance).toBeNull();
    expect(neither.estado).toBe("ninguno");
  });

  it("divides each attempt by its OWN max, so a blueprint change does not corrupt the pair", () => {
    // An attempt taken when the instrument was 34 points stays out of 34 forever.
    const [row] = pairedRows([
      student({
        entry: attempt({ totalRaw: 17, maxTotal: 34 }),
        exit: attempt({ form: "B", totalRaw: 20, maxTotal: 37 }),
      }),
    ]);
    expect(row.entradaPct).toBe(50);
    expect(row.salidaPct).toBe(54.1);
    expect(row.avance).toBe(4.1);
  });

  it("tracks the anchor separately — the only score comparable across levels", () => {
    const [row] = pairedRows([
      student({
        entry: attempt({ anchorRaw: 3, maxAnchor: 8 }),
        exit: attempt({ form: "B", anchorRaw: 6, maxAnchor: 8 }),
      }),
    ]);
    expect(row.anclaEntradaPct).toBe(37.5);
    expect(row.anclaSalidaPct).toBe(75);
    expect(row.anclaAvance).toBe(37.5);
  });

  it("reports negative gain rather than clamping it", () => {
    const [row] = pairedRows([
      student({ exit: attempt({ form: "B", totalRaw: 14 }) }),
    ]);
    expect(row.avance).toBeLessThan(0);
  });

  it("counts the days between submissions", () => {
    const [row] = pairedRows([student()]);
    expect(row.dias).toBe(100);
  });

  it("has no days when a side is missing", () => {
    expect(pairedRows([student({ exit: null })])[0].dias).toBeNull();
  });

  it("labels an unmapped professor rather than leaving it blank", () => {
    expect(pairedRows([student({ professorName: null })])[0].profesor).toBe("sin asignar");
  });

  it("blanks a zero academic semester instead of printing 0", () => {
    expect(pairedRows([student({ academicSemester: 0 })])[0].semestre).toBe("");
  });

  it("sorts by professor, level, group, name", () => {
    const rows = pairedRows([
      student({ professorName: "Zavala", fullName: "Ana" }),
      student({ professorName: "Ávila", fullName: "Zoe" }),
      student({ professorName: "Ávila", fullName: "Ana" }),
    ]);
    expect(rows.map((r) => `${r.profesor}/${r.nombre}`)).toEqual([
      "Ávila/Ana",
      "Ávila/Zoe",
      "Zavala/Ana",
    ]);
  });
});

suite("pairedCsv", () => {
  it("carries the UTF-8 BOM so Spanish Excel does not mojibake names", () => {
    const csv = pairedCsv([student()]);
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain("Ana Ramírez");
  });

  it("is wide format — one row per student, both windows on it", () => {
    const csv = pairedCsv([student()], { bom: false });
    const lines = csv.trim().split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[0]).toContain("Entrada %");
    expect(lines[0]).toContain("Salida %");
    expect(lines[0]).toContain("Avance");
  });

  it("emits an empty cell, not 'null', for an unknown gain", () => {
    const csv = pairedCsv([student({ exit: null })], { bom: false });
    expect(csv).not.toContain("null");
  });

  it("exports every column the row type carries", () => {
    const [row] = pairedRows([student()]);
    expect(PAIRED_COLUMNS.map((c) => c.key).sort()).toEqual(Object.keys(row).sort());
  });
});

suite("pairedFilename", () => {
  it("strips accents and spaces", () => {
    expect(pairedFilename("Ago-Dic 2026")).toBe("Umbral_avance_Ago-Dic-2026.csv");
    expect(pairedFilename("Ago-Dic 2026", "Ramírez Gómez")).toBe(
      "Umbral_avance_Ago-Dic-2026_Ramirez-Gomez.csv",
    );
  });
});

suite("gainDirection", () => {
  it("separates up, flat and down", () => {
    const rows = pairedRows([
      student({ exit: attempt({ form: "B", totalRaw: 26 }) }), // up
      student({ exit: attempt({ form: "B", totalRaw: 20 }) }), // flat
      student({ exit: attempt({ form: "B", totalRaw: 14 }) }), // down
      student({ exit: null }), // unknown — must not be counted anywhere
    ]);
    expect(gainDirection(rows)).toEqual({ subieron: 1, iguales: 1, bajaron: 1 });
  });
});

suite("pairCoverage", () => {
  it("counts all four states over every enrollment", () => {
    const rows = pairedRows([
      student(),
      student({ exit: null }),
      student({ entry: null }),
      student({ entry: null, exit: null }),
    ]);
    expect(pairCoverage(rows)).toEqual({
      total: 4,
      completo: 1,
      soloEntrada: 1,
      soloSalida: 1,
      ninguno: 1,
    });
  });
});

suite("gainBy", () => {
  it("summarises only the students who have both measurements", () => {
    const rows = pairedRows([
      student({ englishLevel: 1 }),
      student({ englishLevel: 1, exit: null }),
      student({ englishLevel: 2 }),
    ]);
    const groups = gainBy(rows, (r) => r.nivel);
    expect(groups.map((g) => g.key)).toEqual(["Inglés 1", "Inglés 2"]);
    expect(groups[0].avance.n).toBe(1); // the unpaired student is absent
  });

  it("is empty before any exit window has run", () => {
    const rows = pairedRows([student({ exit: null }), student({ exit: null })]);
    expect(pairedOnly(rows)).toHaveLength(0);
    expect(gainBy(rows, (r) => r.nivel)).toHaveLength(0);
  });
});

suite("formEffect", () => {
  it("compares mean gain between the AB and BA arms", () => {
    // Both arms gain 6 raw points: counterbalancing is doing its job.
    const rows = pairedRows([
      student({ formOrder: "AB", entry: attempt({ totalRaw: 18 }), exit: attempt({ form: "B", totalRaw: 24 }) }),
      student({ formOrder: "BA", entry: attempt({ form: "B", totalRaw: 18 }), exit: attempt({ totalRaw: 24 }) }),
    ]);
    const fx = formEffect(rows);
    expect(fx.ab.avance.n).toBe(1);
    expect(fx.ba.avance.n).toBe(1);
    expect(fx.gainDifference).toBe(0);
  });

  it("surfaces a difference when one arm gains more than the other", () => {
    const rows = pairedRows([
      student({ formOrder: "AB", entry: attempt({ totalRaw: 18 }), exit: attempt({ form: "B", totalRaw: 30 }) }),
      student({ formOrder: "BA", entry: attempt({ form: "B", totalRaw: 18 }), exit: attempt({ totalRaw: 21 }) }),
    ]);
    expect(formEffect(rows).gainDifference).toBeGreaterThan(0);
  });

  it("reports the ENTRY difference too — a lopsided draw is not a form effect", () => {
    // Same gain in both arms, but the AB arm simply started stronger. Reading
    // only the gain difference would call this equivalence; reading only the
    // entry means would call it bias. Both numbers have to be on the page.
    const rows = pairedRows([
      student({ formOrder: "AB", entry: attempt({ totalRaw: 30 }), exit: attempt({ form: "B", totalRaw: 33 }) }),
      student({ formOrder: "BA", entry: attempt({ form: "B", totalRaw: 10 }), exit: attempt({ totalRaw: 13 }) }),
    ]);
    const fx = formEffect(rows);
    expect(fx.gainDifference).toBe(0);
    expect(fx.entryDifference).toBeGreaterThan(0);
  });

  it("is null, not zero, while an arm is empty", () => {
    const rows = pairedRows([student({ formOrder: "AB" })]);
    const fx = formEffect(rows);
    expect(fx.ba.avance.n).toBe(0);
    expect(fx.gainDifference).toBeNull();
    expect(fx.entryDifference).toBeNull();
  });

  it("ignores unpaired students entirely", () => {
    const rows = pairedRows([
      student({ formOrder: "AB", exit: null }),
      student({ formOrder: "BA", exit: null }),
    ]);
    const fx = formEffect(rows);
    expect(fx.ab.avance.n).toBe(0);
    expect(fx.ba.avance.n).toBe(0);
  });
});
