import { normalizeMatricula } from "./exports";

/**
 * Parse a pasted or uploaded class list.
 *
 * The input is whatever came out of a spreadsheet, so the parser is written for
 * that reality rather than for a specification:
 *
 *  - **The delimiter is detected, not assumed.** Spanish-locale Excel exports
 *    `;` rather than `,` (the comma is its decimal separator). Hard-coding a
 *    comma would make a perfectly good file parse as one column per row.
 *  - **A UTF-8 BOM is stripped**, because Excel writes one and it would
 *    otherwise become part of the first matrícula.
 *  - **The header row is optional and detected**, since half of these files will
 *    be pasted with it and half without.
 *  - **Bad lines are reported with their line number, never skipped silently.**
 *    A roster that quietly dropped three students would produce three false
 *    `sin empezar` absences — the exact error that gets a student chased for
 *    something they did.
 */

export interface RosterLine {
  matricula: string;
  fullName: string | null;
  englishLevel: number;
  group: string;
}

export interface RosterParse {
  rows: RosterLine[];
  /** Lines that could not be used, with the reason and the 1-based line number. */
  errors: { line: number; text: string; reason: string }[];
  /** Duplicate matrículas within the pasted text itself. */
  duplicates: string[];
  delimiter: string;
  headerSkipped: boolean;
}

const HEADER_HINT = /matr[ií]cula|nombre|nivel|grupo/i;

/** Comma, semicolon or tab — whichever appears most on the first non-empty line. */
function detectDelimiter(firstLine: string): string {
  const counts = [",", ";", "\t"].map((d) => [d, firstLine.split(d).length - 1] as const);
  const best = counts.reduce((a, b) => (b[1] > a[1] ? b : a));
  return best[1] > 0 ? best[0] : ",";
}

/** Minimal RFC-4180 field splitter: honours "quoted, fields" containing the delimiter. */
function splitLine(line: string, delimiter: string): string[] {
  const out: string[] = [];
  let field = "";
  let quoted = false;

  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (quoted) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') {
      quoted = true;
    } else if (c === delimiter) {
      out.push(field);
      field = "";
    } else field += c;
  }
  out.push(field);
  return out.map((f) => f.trim());
}

export function parseRoster(text: string): RosterParse {
  const clean = text.replace(/^﻿/, "");
  const lines = clean.split(/\r?\n/);

  const firstContent = lines.find((l) => l.trim() !== "") ?? "";
  const delimiter = detectDelimiter(firstContent);

  const rows: RosterLine[] = [];
  const errors: RosterParse["errors"] = [];
  const seen = new Map<string, number>();
  const duplicates: string[] = [];
  let headerSkipped = false;

  lines.forEach((raw, i) => {
    const lineNo = i + 1;
    if (raw.trim() === "") return;

    const cells = splitLine(raw, delimiter);

    // A header is only skipped when it is the FIRST content line and looks like
    // one. Matching anywhere would silently drop a student named "Nivel".
    if (!headerSkipped && rows.length === 0 && errors.length === 0 && HEADER_HINT.test(raw)) {
      const numeric = cells.some((c) => /^[1-4]$/.test(c));
      if (!numeric) {
        headerSkipped = true;
        return;
      }
    }

    if (cells.length < 3) {
      errors.push({ line: lineNo, text: raw.slice(0, 60), reason: "faltan columnas" });
      return;
    }

    // matrícula, nombre, nivel, grupo — but a list without names is common, so
    // a 3-column line is read as matrícula, nivel, grupo.
    const hasName = cells.length >= 4;
    const matricula = normalizeMatricula(cells[0] ?? "");
    const fullName = hasName ? (cells[1] || null) : null;
    const levelCell = cells[hasName ? 2 : 1] ?? "";
    const groupCell = cells[hasName ? 3 : 2] ?? "";

    if (!matricula) {
      errors.push({ line: lineNo, text: raw.slice(0, 60), reason: "matrícula vacía" });
      return;
    }

    const englishLevel = Number(levelCell.replace(/[^0-9]/g, ""));
    if (!Number.isInteger(englishLevel) || englishLevel < 1 || englishLevel > 4) {
      errors.push({ line: lineNo, text: raw.slice(0, 60), reason: `nivel inválido: "${levelCell}"` });
      return;
    }

    const group = groupCell.toUpperCase().replace(/[^A-Z]/g, "");
    if (!group) {
      errors.push({ line: lineNo, text: raw.slice(0, 60), reason: `grupo inválido: "${groupCell}"` });
      return;
    }

    const already = seen.get(matricula);
    if (already !== undefined) {
      duplicates.push(matricula);
      // Last one wins, and the duplicate is surfaced rather than hidden — a
      // student legitimately moves group mid-semester, and the newer line is the
      // better guess, but Carlos should see that it happened.
      rows[already] = { matricula, fullName, englishLevel, group };
      return;
    }

    seen.set(matricula, rows.length);
    rows.push({ matricula, fullName, englishLevel, group });
  });

  return { rows, errors, duplicates: [...new Set(duplicates)], delimiter, headerSkipped };
}

/** Human name for the detected delimiter, for the preview screen. */
export function delimiterLabel(d: string): string {
  return d === ";" ? "punto y coma" : d === "\t" ? "tabulador" : "coma";
}
