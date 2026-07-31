import type { Block } from "./types";

/**
 * Skill subscores — performance broken out by Reading, Writing, Listening,
 * Speaking and Use of English (Carlos, 2026-07-30).
 *
 * DERIVED, NEVER STORED. Every `Response` row already carries its `block`, so a
 * breakdown is a pure function of rows that exist. That means no migration, it
 * applies retroactively to attempts already submitted, and re-deciding a mapping
 * later reflows history instead of stranding it — the same rule as percentages
 * and gain (PLAN §5).
 *
 * ── WHY "USE OF ENGLISH" EXISTS ──────────────────────────────────────────────
 *
 * The brief was four skills, with Writing inferred from the multiple-choice and
 * open items rather than from a free-writing box. The inference is sound for the
 * items where a student TYPES English (the cloze blanks): that is written
 * production, just at word/phrase level rather than discourse level.
 *
 * It is NOT sound for grammar multiple-choice, true/false or matching. Those are
 * recognition tasks — the student picks, they do not produce — and 16 of the 26
 * level points sit there. Folding them into "Writing" would (a) be a category
 * error a thesis reader would go after first, and (b) swamp the 5 points of real
 * written production, so the Writing number would move when recognition moved and
 * would tell you nothing about writing.
 *
 * So recognition gets its own honest name. "Use of English" is the standard term
 * for exactly this construct (Cambridge uses it for the same reason), and keeping
 * it separate is what leaves the Writing subscore interpretable.
 *
 * ── LIMITATION, ON THE RECORD ────────────────────────────────────────────────
 *
 * Reading is 3 points, Speaking 2, Listening 3. At that length a subscore is a
 * COHORT indicator, not an individual diagnostic — the same rule that governs the
 * anchor (PLAN §2.5). A group mean over 100 students is 200–300 observations and
 * is perfectly usable for trends and for a thesis. One student's 2-point Speaking
 * score is noise. Report these on the admin dashboard, aggregated; never on a
 * student's result screen, and never as "your Reading level is X".
 */

export type Skill = "reading" | "writing" | "listening" | "speaking" | "use";

export const SKILLS: Skill[] = ["reading", "writing", "listening", "speaking", "use"];

/** Dashboard labels. Spanish, like the rest of the interface. */
export const SKILL_LABEL: Record<Skill, string> = {
  reading: "Lectura",
  // Scoped on purpose: the label has to carry what the evidence actually is, or
  // the number will be read as CEFR-style discourse writing.
  writing: "Escritura (palabra y frase)",
  listening: "Comprensión auditiva",
  speaking: "Expresión oral",
  use: "Uso del inglés",
};

/** One line each, for the dashboard's own tooltips — and for a methods section. */
export const SKILL_NOTE: Record<Skill, string> = {
  reading: "Comprensión de un texto: preguntas de opción y una respuesta abierta sobre lo que dice.",
  writing:
    "Producción escrita a nivel de palabra y frase: el estudiante escribe la forma correcta en el texto con espacios. No incluye redacción libre.",
  listening: "Comprensión de audios cortos de conversación cotidiana.",
  speaking: "Respuestas habladas, transcritas y calificadas por estructura, no por contenido.",
  use: "Reconocimiento de gramática y vocabulario: opción múltiple, verdadero/falso y relacionar columnas.",
};

/**
 * Block → skill. One block maps to exactly ONE skill.
 *
 * Multi-mapping (an item counting toward both Reading and Writing) was rejected:
 * subscores stop summing to the total, "62 % across skills" becomes unexplainable
 * to a professor, and any weighting becomes an arbitrary decision buried in code.
 *
 * The reading block's open item is the close call — the student types, so it is
 * production. It stays under Reading because what is being ASSESSED is whether
 * they understood the passage; the typing is the response channel, not the
 * construct. Move it by tagging that item with `skill` if this proves wrong;
 * `skillOf` honours a per-item override.
 */
const SKILL_BY_BLOCK: Record<Block, Skill> = {
  anchor: "use",
  listening: "listening",
  grammar: "use",
  truefalse: "use",
  match: "use",
  gapfill: "writing",
  reading: "reading",
  speaking: "speaking",
};

export function skillOfBlock(block: Block): Skill {
  return SKILL_BY_BLOCK[block];
}

/** Per-item override wins, so a mapping can be corrected without regenerating the bank. */
export function skillOf(block: Block, itemSkill?: Skill | null): Skill {
  return itemSkill ?? SKILL_BY_BLOCK[block];
}

export interface SkillScore {
  skill: Skill;
  label: string;
  points: number;
  max: number;
  /** Null when the skill contributed no items — NOT zero, which would read as
   *  "they scored nothing" instead of "this was not measured". */
  pct: number | null;
  items: number;
  skipped: number;
}

export interface ResponseLike {
  block: string;
  points: number;
  maxPoints: number;
  skipped?: boolean;
  skill?: Skill | null;
}

/**
 * Break an attempt's responses down by skill.
 *
 * `includeAnchor` defaults to FALSE. The anchor's job is to be the cross-level
 * ruler (PLAN §2.2); folding its 8 shared items into "Use of English" alongside
 * level-specific items would make that subscore partly-shared and partly-not, so
 * it would answer neither "how is this cohort doing on grammar" nor "how do the
 * levels compare". Analyse the anchor on its own, by CEFR band.
 */
export function breakdownBySkill(
  responses: ResponseLike[],
  { includeAnchor = false }: { includeAnchor?: boolean } = {},
): SkillScore[] {
  const acc = new Map<Skill, { points: number; max: number; items: number; skipped: number }>();

  for (const r of responses) {
    if (!includeAnchor && r.block === "anchor") continue;
    const skill = skillOf(r.block as Block, r.skill);
    if (!skill) continue;
    const cur = acc.get(skill) ?? { points: 0, max: 0, items: 0, skipped: 0 };
    cur.points += r.points;
    cur.max += r.maxPoints;
    cur.items += 1;
    if (r.skipped) cur.skipped += 1;
    acc.set(skill, cur);
  }

  return SKILLS.map((skill) => {
    const a = acc.get(skill);
    return {
      skill,
      label: SKILL_LABEL[skill],
      points: a?.points ?? 0,
      max: a?.max ?? 0,
      pct: a && a.max > 0 ? Math.round((a.points / a.max) * 1000) / 10 : null,
      items: a?.items ?? 0,
      skipped: a?.skipped ?? 0,
    };
  });
}

/**
 * How many points each skill is WORTH on a form, independent of any student.
 *
 * The dashboard shows this next to every subscore, because the honest caveat is
 * not a footnote: a reader has to see that "Expresión oral 50 %" came out of two
 * points before they draw a conclusion from it.
 */
export function skillWeights(
  items: { block: Block; points: number; skill?: Skill | null }[],
  { includeAnchor = false }: { includeAnchor?: boolean } = {},
): Record<Skill, number> {
  const out = Object.fromEntries(SKILLS.map((s) => [s, 0])) as Record<Skill, number>;
  for (const i of items) {
    if (!includeAnchor && i.block === "anchor") continue;
    out[skillOf(i.block, i.skill)] += i.points;
  }
  return out;
}

/**
 * Is a subscore long enough to say anything about ONE student?
 *
 * Measured in POINTS, not items. A match block is a single item worth six points,
 * but those are six independent judgements — counting it as one would understate
 * the evidence by a factor of six. Roughly one point ≈ one observation.
 *
 * Ten is the rough floor at which a per-person percentage stops being mostly
 * noise. On the current blueprint only "Use of English" clears it (16 points);
 * Writing has 5, Listening 3, Reading 3 and Speaking 2, so those four are
 * cohort-only. The dashboard calls this to decide whether an individual value is
 * printable at all, rather than leaving the judgement to whoever reads the chart.
 */
export const INDIVIDUAL_MIN_POINTS = 10;

export function isIndividuallyReportable(score: SkillScore): boolean {
  return score.max >= INDIVIDUAL_MIN_POINTS;
}
