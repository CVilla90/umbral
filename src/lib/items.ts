import { allForms } from "@/content/forms";
import type { Block, Item } from "./types";
import { correlation, describe } from "./stats";

/**
 * Classical item analysis — how each individual question behaved.
 *
 * This is the file that turns "the exam works" into "these four questions do
 * not". It is the quality-control loop the printed exams never had: the
 * inherited banks carry a measured defect (option `c` correct zero times in
 * levels 1–3) that nobody caught for years because no one ever tabulated the
 * answers. Pure functions over plain rows, so the arithmetic is testable.
 *
 * ⚠️ `Response.raw` for an mcq stores **both** indices — `{ authored, shown }`.
 * The authored one is what item analysis needs, and it is already there; no
 * re-derivation through `optionOrder` is required, and doing it would risk
 * disagreeing with what was actually graded.
 */

/* ------------------------------------------------------------------ *
 * The bank index
 * ------------------------------------------------------------------ */

export interface BankEntry {
  item: Item;
  block: Block;
  /** Anchor items appear in all four levels — that is the point of them. */
  levels: number[];
  forms: string[];
}

/**
 * Every item in every form, keyed by id.
 *
 * ⚠️ The eight anchor items are the SAME ids across all four levels, so their
 * entry carries four levels and their n is four times everyone else's. That is
 * not double counting: an anchor item genuinely is one question answered by the
 * whole faculty, which is exactly what makes it the cross-level ruler (PLAN §2.2).
 */
export function bankIndex(): Map<string, BankEntry> {
  const index = new Map<string, BankEntry>();
  for (const form of allForms()) {
    for (const block of form.blocks) {
      for (const item of block.items) {
        const found = index.get(item.id);
        if (found) {
          if (!found.levels.includes(form.level)) found.levels.push(form.level);
          if (!found.forms.includes(form.form)) found.forms.push(form.form);
        } else {
          index.set(item.id, {
            item,
            block: block.block,
            levels: [form.level],
            forms: [form.form],
          });
        }
      }
    }
  }
  return index;
}

/** A one-line label for a table row. Never the answer. */
export function itemLabel(item: Item): string {
  switch (item.type) {
    case "mcq":
      return item.stem;
    case "tf":
      return item.sentence;
    case "open":
    case "speaking":
      return item.stem;
    case "match":
      return `${item.pairs.length} pares`;
    case "gap": {
      const first = item.segments.find((s) => s.kind === "text");
      const blanks = item.segments.filter((s) => s.kind === "blank").length;
      return `${blanks} espacios · ${first && first.kind === "text" ? first.value.trim() : ""}`;
    }
  }
}

/* ------------------------------------------------------------------ *
 * Analysis
 * ------------------------------------------------------------------ */

export interface ItemResponseRow {
  itemId: string;
  block: string;
  type: string;
  raw: unknown;
  points: number;
  maxPoints: number;
  msElapsed: number | null;
  skipped: boolean;
  /** The attempt's total raw score. Needed for discrimination. */
  attemptTotal: number;
}

export interface OptionCount {
  authoredIndex: number;
  text: string;
  picks: number;
  isCorrect: boolean;
}

export interface ItemAnalysis {
  itemId: string;
  block: string;
  type: string;
  label: string;
  tag: string | null;
  levels: number[];
  forms: string[];
  maxPoints: number;
  n: number;
  /** Proportion of the available points earned. See `pValue` below. */
  pValue: number | null;
  skipped: number;
  /** Median, not mean — response latency is right-skewed and one student who
   *  walked away would drag a mean into nonsense. */
  medianSeconds: number | null;
  discrimination: number | null;
  /** MCQ only. Null for every other type. */
  options: OptionCount[] | null;
}

/**
 * The difficulty index.
 *
 * For a one-point question this is the classical p-value: the proportion of
 * students who got it right. For match and cloze items, which are scored per row
 * and per blank, it generalises to the proportion of available points earned —
 * the same number, and the only one that keeps a 6-point match item on the same
 * scale as a 1-point question.
 *
 * High is EASY. p = 0.95 means almost everyone got it, which for a measurement
 * instrument is close to useless: it separates nobody.
 */
function pValueOf(rows: ItemResponseRow[]): number | null {
  const max = rows.reduce((s, r) => s + r.maxPoints, 0);
  if (max <= 0) return null;
  return rows.reduce((s, r) => s + r.points, 0) / max;
}

/**
 * Corrected item–total correlation.
 *
 * How well this one item sorts students the same way the whole instrument does.
 * The item's own points are **removed from the total** before correlating —
 * with only 28 items, an item correlated against a total it is itself part of
 * would flatter every item, and the weakest ones are precisely where that
 * inflation matters.
 *
 * Reading it: around 0.2 and up is a healthy item; near zero means it separates
 * nobody; **negative means the stronger students are getting it wrong**, which
 * almost always indicates a miskeyed answer or an ambiguous option, and is the
 * single most valuable signal on the whole page.
 */
function discriminationOf(rows: ItemResponseRow[]): number | null {
  const itemScores = rows.map((r) => (r.maxPoints > 0 ? r.points / r.maxPoints : 0));
  const restScores = rows.map((r) => r.attemptTotal - r.points);
  return correlation(itemScores, restScores);
}

function optionCountsOf(entry: BankEntry, rows: ItemResponseRow[]): OptionCount[] | null {
  const item = entry.item;
  if (item.type !== "mcq") return null;

  const picks = new Array<number>(item.choices.length).fill(0);
  for (const row of rows) {
    const raw = row.raw;
    if (!raw || typeof raw !== "object") continue;
    const authored = (raw as { authored?: unknown }).authored;
    if (typeof authored === "number" && authored >= 0 && authored < picks.length) {
      picks[authored] += 1;
    }
  }

  return item.choices.map((text, i) => ({
    authoredIndex: i,
    text,
    picks: picks[i],
    isCorrect: i === item.correct,
  }));
}

/**
 * One analysis row per item that has at least one response.
 *
 * Items nobody has answered are absent rather than present with n = 0: a table
 * of 200 empty rows buries the handful that carry information.
 */
export function analyseItems(
  responses: ItemResponseRow[],
  index: Map<string, BankEntry> = bankIndex(),
): ItemAnalysis[] {
  const byItem = new Map<string, ItemResponseRow[]>();
  for (const r of responses) {
    const list = byItem.get(r.itemId);
    if (list) list.push(r);
    else byItem.set(r.itemId, [r]);
  }

  const out: ItemAnalysis[] = [];
  for (const [itemId, rows] of byItem) {
    const entry = index.get(itemId);
    const latencies = rows
      .map((r) => r.msElapsed)
      .filter((v): v is number => v !== null && v > 0)
      .map((ms) => ms / 1000);

    out.push({
      itemId,
      // An item retired from the bank still has responses in the database
      // forever, and they must stay visible — that is the whole point of
      // `itemSnapshot`. Fall back to what the response row itself recorded.
      block: entry?.block ?? rows[0].block,
      type: entry?.item.type ?? rows[0].type,
      label: entry ? itemLabel(entry.item) : "(reactivo retirado del banco)",
      tag: entry?.item.tag ?? null,
      levels: entry?.levels ?? [],
      forms: entry?.forms ?? [],
      maxPoints: rows[0].maxPoints,
      n: rows.length,
      pValue: pValueOf(rows),
      skipped: rows.filter((r) => r.skipped).length,
      medianSeconds: describe(latencies).median,
      discrimination: discriminationOf(rows),
      options: entry ? optionCountsOf(entry, rows) : null,
    });
  }

  return out.sort((a, b) => a.block.localeCompare(b.block) || a.itemId.localeCompare(b.itemId));
}

/* ------------------------------------------------------------------ *
 * Flags
 * ------------------------------------------------------------------ */

export type ItemFlag = "muy fácil" | "muy difícil" | "no discrimina" | "revisar clave" | "opción muerta";

/** Below this n, nothing is flagged: small samples produce alarming numbers. */
export const MIN_N_TO_FLAG = 10;

/**
 * What to look at first.
 *
 * ⚠️ Flags are a **reading queue, not a verdict**. Every one of them can be
 * correct behaviour: an easy opener is deliberate, and a hard last item is
 * supposed to separate the top of the cohort. Nothing here should ever
 * auto-remove an item — a human reads the question and decides.
 */
export function flagsFor(a: ItemAnalysis): ItemFlag[] {
  if (a.n < MIN_N_TO_FLAG) return [];
  const flags: ItemFlag[] = [];

  if (a.pValue !== null && a.pValue >= 0.95) flags.push("muy fácil");
  if (a.pValue !== null && a.pValue <= 0.2) flags.push("muy difícil");
  if (a.discrimination !== null && a.discrimination < 0) flags.push("revisar clave");
  else if (a.discrimination !== null && a.discrimination < 0.1) flags.push("no discrimina");

  // A distractor nobody ever picks is doing no work: the item is effectively
  // one option shorter than it looks, which quietly makes it easier than the
  // blueprint says it is.
  if (a.options && a.options.some((o) => !o.isCorrect && o.picks === 0)) {
    flags.push("opción muerta");
  }

  return flags;
}
