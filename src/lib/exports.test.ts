import { describe, it, expect } from "vitest";
import {
  attendanceCsv,
  attendanceFilename,
  attendanceRows,
  attendanceSummary,
  mergeRoster,
  normalizeMatricula,
  participationOf,
  toCsv,
  NO_PROFESSOR,
  type AttendanceInput,
} from "./exports";

const student = (over: Partial<AttendanceInput> = {}): AttendanceInput => ({
  matricula: "A349021",
  fullName: "Ana Pérez",
  email: "ana@uach.mx",
  englishLevel: 2,
  group: "B",
  academicSemester: 3,
  professorName: "Ramírez",
  attempt: null,
  ...over,
});

const done = (completed: boolean) => ({
  state: "submitted",
  completed,
  submittedAt: new Date("2026-08-21T17:30:00Z"),
  totalRaw: 22,
  maxTotal: 34,
});

describe("CSV escaping", () => {
  it("quotes a field containing the delimiter", () => {
    // A student name with a comma shifts every later column by one place, which
    // produces a file that opens fine and is silently wrong.
    const csv = toCsv([{ key: "n", header: "Nombre" }], [{ n: "Pérez Gómez, Ana" }], {
      bom: false,
    });
    expect(csv).toContain('"Pérez Gómez, Ana"');
  });

  it("doubles inner quotes", () => {
    const csv = toCsv([{ key: "n", header: "N" }], [{ n: 'dice "hola"' }], { bom: false });
    expect(csv).toContain('"dice ""hola"""');
  });

  it("quotes a field containing a newline", () => {
    const csv = toCsv([{ key: "n", header: "N" }], [{ n: "linea1\nlinea2" }], { bom: false });
    expect(csv).toContain('"linea1\nlinea2"');
  });

  it("writes empty for null and undefined, not the words", () => {
    const csv = toCsv(
      [
        { key: "a", header: "A" },
        { key: "b", header: "B" },
      ],
      [{ a: null, b: undefined }],
      { bom: false },
    );
    expect(csv.split("\r\n")[1]).toBe(",");
  });

  it("emits a BOM by default", () => {
    // Without it, Excel on Spanish Windows renders "Ramírez" as "RamÃ­rez".
    expect(attendanceCsv([student()]).charCodeAt(0)).toBe(0xfeff);
    expect(toCsv([{ key: "a", header: "A" }], [], { bom: false }).charCodeAt(0)).not.toBe(0xfeff);
  });

  it("supports the semicolon Excel expects in es-MX", () => {
    const csv = toCsv([{ key: "a", header: "A" }], [{ a: "x,y" }], {
      bom: false,
      delimiter: ";",
    });
    // The comma is no longer special, so it needs no quoting.
    expect(csv).toContain("x,y");
    expect(csv).not.toContain('"x,y"');
  });
});

describe("participation has four states, not two", () => {
  it("separates a stalled attempt from a finished one", () => {
    // "empezada" is the nudge list — a professor needs it distinct from both
    // "never opened it" and "done".
    expect(participationOf(null)).toBe("sin empezar");
    expect(
      participationOf({
        state: "in_progress",
        completed: false,
        submittedAt: null,
        totalRaw: null,
        maxTotal: null,
      }),
    ).toBe("empezada");
    expect(participationOf(done(false))).toBe("incompleta");
    expect(participationOf(done(true))).toBe("completa");
  });

  it("counts an auto-submitted attempt as participation", () => {
    // The idle sweep closes abandoned attempts; the student still showed up and
    // still produced data.
    expect(participationOf({ ...done(false), state: "auto_submitted" })).toBe("incompleta");
  });
});

describe("attendance rows", () => {
  it("labels an unmapped group rather than leaving it blank", () => {
    // A blank professor column reads as a rendering bug; it is actually "Carlos
    // has not filled in the group mapping yet".
    const [row] = attendanceRows([student({ professorName: null })]);
    expect(row.profesor).toBe(NO_PROFESSOR);
  });

  it("leaves score columns empty for a student who never started", () => {
    const [row] = attendanceRows([student()]);
    expect(row.participacion).toBe("sin empezar");
    expect(row.fecha).toBe("");
    expect(row.puntos).toBe("");
    expect(row.porcentaje).toBe("");
  });

  it("fills score columns for a finished attempt", () => {
    const [row] = attendanceRows([student({ attempt: done(true) })]);
    expect(row.puntos).toBe("22/34");
    expect(row.porcentaje).toBe("64.7");
    expect(row.fecha).not.toBe("");
  });

  it("sorts by professor, then level, group and name, with Spanish collation", () => {
    const rows = attendanceRows([
      student({ fullName: "Zulema", professorName: "Ramírez" }),
      student({ fullName: "Ána", professorName: "Ramírez" }),
      student({ fullName: "Beto", professorName: "Alvarez" }),
    ]);
    expect(rows.map((r) => r.nombre)).toEqual(["Beto", "Ána", "Zulema"]);
  });
});

describe("optional per-group rosters", () => {
  const roster = [
    { matricula: "A349021", fullName: "Ana Pérez", englishLevel: 2, group: "B" },
    { matricula: "a-349022", fullName: "Luis Soto", englishLevel: 2, group: "B" },
  ];

  it("normalizes matrículas before matching", () => {
    // Students type these on a phone; staff transcribe them into a spreadsheet.
    expect(normalizeMatricula(" a-349022 ")).toBe("A349022");
    expect(normalizeMatricula("A349022")).toBe(normalizeMatricula("a 349022"));
  });

  it("adds no-shows only for groups that HAVE a roster", () => {
    const merged = mergeRoster([student({ attempt: done(true) })], roster);
    const rows = attendanceRows(merged);

    expect(rows).toHaveLength(2);
    const luis = rows.find((r) => r.nombre === "Luis Soto")!;
    expect(luis.participacion).toBe("sin empezar");
    expect(luis.enLista).toBe("sí");
    // Never signed in, so there is no academic semester to report.
    expect(luis.semestre).toBe("");
  });

  it("returns only what we know when no roster was uploaded", () => {
    // The normal case, and it must not invent absent students.
    const merged = mergeRoster([student({ attempt: done(true) })], []);
    const rows = attendanceRows(merged);

    expect(rows).toHaveLength(1);
    expect(rows[0].enLista).toBe("");
  });

  it("flags a participant who is not on their group's roster", () => {
    // Real signal: wrong group declared, or the roster is out of date.
    const merged = mergeRoster(
      [student({ matricula: "A999999", fullName: "Nadie", attempt: done(true) })],
      roster,
    );
    const nadie = attendanceRows(merged).find((r) => r.nombre === "Nadie")!;
    expect(nadie.enLista).toBe("no");
  });

  it("does not mark a group unrostered just because another group has one", () => {
    const merged = mergeRoster(
      [student({ englishLevel: 3, group: "C", attempt: done(true) })],
      roster,
    );
    const other = merged.find((s) => s.englishLevel === 3)!;
    expect(other.inRoster).toBeUndefined();
  });
});

describe("attendance summary", () => {
  it("counts who actually showed up, per professor", () => {
    const rows = attendanceRows([
      student({ professorName: "Ramírez", attempt: done(true) }),
      student({ professorName: "Ramírez", attempt: done(false) }),
      student({ professorName: "Ramírez" }),
      student({ professorName: "Alvarez", attempt: done(true) }),
    ]);
    const ramirez = attendanceSummary(rows).find((s) => s.profesor === "Ramírez")!;

    expect(ramirez.total).toBe(3);
    // An incomplete attempt still counts as having participated — the student
    // showed up and produced data.
    expect(ramirez.participaron).toBe(2);
    expect(ramirez["sin empezar"]).toBe(1);
  });

  it("refuses to report a percentage without a roster", () => {
    // THE guard. Dividing by "people who showed up" would put every unrostered
    // group at 100 % in the same table as a rostered group at 58 %, and that
    // comparison would be read as fact.
    const rows = attendanceRows(
      mergeRoster([student({ professorName: "Alvarez", attempt: done(true) })], []),
    );
    const alvarez = attendanceSummary(rows)[0];

    expect(alvarez.participaron).toBe(1);
    expect(alvarez.rostered).toBe(false);
    expect(alvarez.pct).toBeNull();
  });

  it("reports a real percentage once a roster covers the group", () => {
    const rows = attendanceRows(
      mergeRoster(
        [student({ professorName: "Ramírez", attempt: done(true) })],
        [
          { matricula: "A349021", fullName: "Ana Pérez", englishLevel: 2, group: "B" },
          { matricula: "A349022", fullName: "Luis Soto", englishLevel: 2, group: "B" },
        ],
        () => "Ramírez",
      ),
    );
    const ramirez = attendanceSummary(rows)[0];

    expect(ramirez.rostered).toBe(true);
    expect(ramirez.total).toBe(2);
    expect(ramirez.participaron).toBe(1);
    expect(ramirez.pct).toBe(50);
  });
});

describe("filenames", () => {
  it("are safe and say what they contain", () => {
    expect(attendanceFilename("entry", "Ago-Dic 2026", "Ramírez")).toBe(
      "Umbral_asistencia_entrada_Ago-Dic-2026_Ramirez.csv",
    );
    expect(attendanceFilename("exit", "Ago-Dic 2026")).toBe(
      "Umbral_asistencia_salida_Ago-Dic-2026.csv",
    );
  });
});
