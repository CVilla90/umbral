import type {
  GapItem,
  Item,
  MatchItem,
  McqItem,
  OpenItem,
  TfItem,
} from "./types";

/**
 * Deterministic grading. No AI, no network.
 *
 * Even the spoken answers land here: Gemini only turns audio into text, and this
 * file decides whether the text is right (PLAN §7). Keeping the scoring rule in
 * one inspectable place is what lets a result be defended to a student — and to a
 * thesis committee.
 */

/**
 * Fold everything that is typography rather than English: case, accents,
 * punctuation, and runs of whitespace.
 *
 * This is Carlos's "students type the Spanish apostrophe" requirement. A phone
 * keyboard in Spanish autocapitalises, offers `’` (U+2019) rather than `'`, and a
 * Spanish-first typist reaches for `´`. All three fold away here, so `Dont`,
 * `don’t`, `Don´t` and `don't` are one answer. Stripping accents is safe because
 * the answers being compared are English.
 */
export function normalize(input: string): string {
  return input
    .normalize("NFD")
    .replace(/\p{M}+/gu, "") // combining accents
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "") // punctuation and symbols, incl. every apostrophe
    .replace(/\s+/g, " ")
    .trim();
}

export function gradeOpen(value: string, accepted: string[]): boolean {
  const v = normalize(value);
  if (!v) return false;
  return accepted.some((a) => normalize(a) === v);
}

export function gradeMcq(selected: number | null, item: McqItem): boolean {
  return selected !== null && selected === item.correct;
}

export function gradeTf(value: boolean | null, item: TfItem): boolean {
  return value !== null && value === item.correct;
}

/**
 * Match is scored PER ROW, not all-or-nothing: `answer` maps each left label to
 * the right label the student paired with it, and every correct row earns a
 * point. One slip costing six points would contradict the whole "recognition
 * first, nothing all-or-nothing" brief the printed exams were built on.
 */
export function gradeMatch(
  answer: Record<string, string>,
  item: MatchItem,
): { points: number; correctRows: string[] } {
  const correctRows = item.pairs
    .filter((p) => answer[p.left] === p.right)
    .map((p) => p.left);
  return { points: correctRows.length, correctRows };
}

/**
 * Cloze is likewise scored per blank. `answer` is keyed by blank number.
 */
export function gradeGap(
  answer: Record<string, string>,
  item: GapItem,
): { points: number; correctBlanks: number[] } {
  const correctBlanks: number[] = [];
  for (const seg of item.segments) {
    if (seg.kind !== "blank") continue;
    const given = answer[String(seg.n)] ?? "";
    if (gradeOpen(given, seg.accepted)) correctBlanks.push(seg.n);
  }
  return { points: correctBlanks.length, correctBlanks };
}

export type Response =
  | { kind: "mcq"; value: number | null }
  | { kind: "tf"; value: boolean | null }
  | { kind: "open"; value: string }
  | { kind: "match"; value: Record<string, string> }
  | { kind: "gap"; value: Record<string, string> }
  | { kind: "speaking"; transcript: string | null };

/**
 * Single entry point. Returns points earned out of `item.points`.
 *
 * A skipped item, a blank answer and a dead microphone all land on 0 — every item
 * is graded, so a student who cannot record cannot reach 100 % (Carlos,
 * 2026-07-30). The REASON is recorded separately on the response row, which is
 * what keeps "couldn't" distinguishable from "wouldn't" in the analysis.
 */
export function gradeItem(item: Item, response: Response | null): number {
  if (!response) return 0;

  switch (item.type) {
    case "mcq":
      return response.kind === "mcq" && gradeMcq(response.value, item) ? 1 : 0;
    case "tf":
      return response.kind === "tf" && gradeTf(response.value, item) ? 1 : 0;
    case "open":
      return response.kind === "open" && gradeOpen(response.value, (item as OpenItem).accepted)
        ? 1
        : 0;
    case "match":
      return response.kind === "match" ? gradeMatch(response.value, item).points : 0;
    case "gap":
      return response.kind === "gap" ? gradeGap(response.value, item).points : 0;
    case "speaking":
      if (response.kind !== "speaking" || !response.transcript) return 0;
      // Lenient by design: a personal question has no wrong content, only a
      // wrong structure, and an empty `accepted` list means any intelligible
      // answer counts.
      return item.accepted.length === 0 || gradeOpen(response.transcript, item.accepted)
        ? 1
        : 0;
  }
}
