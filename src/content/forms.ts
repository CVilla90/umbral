import type { Form, FormBlock, FormId, Item } from "@/lib/types";
import { ANCHOR } from "./anchor";
import { listeningBlock } from "./listening";
import level1 from "./bank/level1.json";
import level2 from "./bank/level2.json";
import level3 from "./bank/level3.json";
import level4 from "./bank/level4.json";

/**
 * Assembles the eight forms a student can be served: four levels × {A, B}.
 *
 * The level-specific blocks come from `bank/level*.json`, generated once from
 * `english_test_generator` by `tools/export_bank.py` and then owned by this repo.
 * The anchor is prepended here because it is the one block that is identical
 * across levels — that is the whole point of it (PLAN §2.2).
 *
 * WHICH FORM A STUDENT GETS is never decided here. It follows from
 * `Enrollment.formOrder` ("AB" or "BA", assigned 50/50 once) and the window's
 * phase, so entry and exit can never serve the same form and repeat prevention is
 * structural rather than a per-student ledger (PLAN §2.1).
 */

interface LevelBank {
  level: number;
  course: string;
  cefr: string;
  lessons: number;
  forms: Record<string, unknown>;
}

const BANKS: Record<number, LevelBank> = {
  1: level1 as LevelBank,
  2: level2 as LevelBank,
  3: level3 as LevelBank,
  4: level4 as LevelBank,
};

export const LEVELS = [1, 2, 3, 4] as const;
export type Level = (typeof LEVELS)[number];

export function isLevel(n: number): n is Level {
  return LEVELS.includes(n as Level);
}

export function levelMeta(level: Level) {
  const bank = BANKS[level];
  return { course: bank.course, cefr: bank.cefr, lessons: bank.lessons };
}

function anchorBlock(form: FormId): FormBlock {
  return {
    block: "anchor",
    title: "Para empezar",
    instruction: "Ocho frases, de la más sencilla a la más difícil. Si una se te complica, pasa a la siguiente.",
    // The band field is extra data on the item; it is carried through for the
    // dashboard's per-band analysis and ignored by the player.
    items: ANCHOR[form] as unknown as Item[],
  };
}

export function getForm(level: Level, form: FormId): Form {
  const bank = BANKS[level];
  const raw = bank.forms[form] as Form | undefined;
  if (!raw) throw new Error(`No form ${form} for level ${level}`);

  // Authored in `listening.ts` with its 24 edge-tts clips (PLAN §3.3). This is
  // what takes the instrument from 34 points to the blueprint's 37, and it was
  // added BEFORE the entry window opened on purpose: an instrument whose maximum
  // changes between its own two windows cannot compare them, and the gain score
  // — the entire point — would become uninterpretable.
  const listening = listeningBlock(level, form);

  return {
    level,
    form,
    blocks: [anchorBlock(form), ...(listening ? [listening] : []), ...raw.blocks],
  };
}

/** Every form, for the validator and for the admin's item analysis. */
export function allForms(): Form[] {
  return LEVELS.flatMap((l) => (["A", "B"] as FormId[]).map((f) => getForm(l, f)));
}
