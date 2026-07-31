/**
 * The item bank's shape. Everything a student is ever shown conforms to this, and
 * `bank.test.ts` enforces the blueprint against it at build time — the direct
 * analogue of `english_test_generator/examstyle/validate.py`, which is what keeps
 * a printed instrument honest.
 */

export type Block =
  | "anchor"
  | "listening"
  | "grammar"
  | "truefalse"
  | "match"
  | "gapfill"
  | "reading"
  | "speaking";

export type ItemType = "mcq" | "tf" | "match" | "gap" | "open" | "speaking";

export type FormId = "A" | "B";

interface ItemBase {
  /** Globally unique and STABLE. It is written into `Response.itemId` forever, so
   *  renaming one silently orphans historical data. */
  id: string;
  type: ItemType;
  /** Maximum points. Match and gap items are worth more than one. */
  points: number;
  /** Provenance — which lesson/level this came from. Never shown to a student;
   *  it is what makes per-item analysis interpretable in the dashboard. */
  tag?: string;
  /** A clip the student listens to before answering THIS item.
   *
   *  Per item, not per block: the blueprint budgets 24 clips for 4 levels × 2
   *  forms × 3 items (PLAN §3.3), so each listening question carries its own
   *  audio. `FormBlock.audio` remains for a future block where several questions
   *  share one longer recording. */
  audio?: AudioClip;
}

export interface McqItem extends ItemBase {
  type: "mcq";
  stem: string;
  choices: string[];
  /** Index into `choices` as authored. The per-attempt shuffle permutes the
   *  presentation and remaps this — it never rewrites the stored answer. */
  correct: number;
}

export interface TfItem extends ItemBase {
  type: "tf";
  sentence: string;
  correct: boolean;
}

export interface MatchItem extends ItemBase {
  type: "match";
  /** `points` equals `pairs.length` — a match block is scored per row, not
   *  all-or-nothing, so one slip doesn't cost six points. */
  pairs: { left: string; right: string }[];
}

/** One cloze passage. Several blanks, one screen, one row in `Response`. */
export interface GapItem extends ItemBase {
  type: "gap";
  /** The word bank shown above the text. Every entry is a distractor or an
   *  answer; `bank.test.ts` checks no two entries fit the same blank, which is
   *  the defect class that bit every level of the printed exams. */
  wordBank: string[];
  /** Text split into literal runs and blanks, so the renderer never parses
   *  markup at runtime. */
  segments: GapSegment[];
}

export type GapSegment =
  | { kind: "text"; value: string }
  /** A blank the student fills. `n` is its number in the passage. */
  | { kind: "blank"; n: number; answer: string; accepted: string[] }
  /** A blank the source text had but this form does not score — rendered as the
   *  plain word. Truncating a cloze passage to hit a point budget would break the
   *  prose; deactivating blanks keeps the passage whole. */
  | { kind: "filled"; value: string };

export interface OpenItem extends ItemBase {
  type: "open";
  stem: string;
  /** Any of these, compared after `normalize()`. */
  accepted: string[];
  /** Shown after answering, so a wrong answer still teaches something. */
  model?: string;
}

export interface SpeakingItem extends ItemBase {
  type: "speaking";
  stem: string;
  /** Structure being elicited — used in the Gemini prompt and in item analysis. */
  target: string;
  /** ALWAYS EMPTY, and `bank.test.ts` enforces it.
   *
   *  `gradeItem` reads an empty list as "any intelligible answer scores", which is
   *  the only defensible rule for a PERSONAL question — there is no enumerable
   *  set of right answers to "where are you from?". A non-empty list here would
   *  also silently make one form harder than the other, which is the bug this
   *  field carried until 2026-07-31. */
  accepted: string[];
  /** The CLAVE's illustrative answer, where the source had one. Reference and
   *  item analysis only — never consulted by the grader. */
  model?: string | null;
  maxSeconds: number;
}

export type Item = McqItem | TfItem | MatchItem | GapItem | OpenItem | SpeakingItem;

export interface Passage {
  title: string;
  paragraphs: string[];
}

export interface AudioClip {
  id: string;
  /** Kept in the bank so the CLAVE-equivalent and the accessibility transcript
   *  come from one place. Never rendered before the student answers. */
  transcript: string;
  src: string;
  voice?: string;
}

export interface FormBlock {
  block: Block;
  /** Spanish, shown as the section heading. */
  title: string;
  /** Spanish, one line, plain. */
  instruction: string;
  passage?: Passage;
  audio?: AudioClip;
  items: Item[];
}

export interface Form {
  level: number;
  form: FormId;
  blocks: FormBlock[];
}

/** Total points a form is worth, derived — never written down. */
export function formPoints(form: Form): number {
  return form.blocks.reduce(
    (sum, b) => sum + b.items.reduce((s, i) => s + i.points, 0),
    0,
  );
}

/** Points contributed by one block, derived. */
export function blockPoints(block: FormBlock): number {
  return block.items.reduce((s, i) => s + i.points, 0);
}
