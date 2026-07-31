import type { Form, FormBlock, Item } from "./types";

/**
 * Flattens a form into the sequence of screens a student actually walks through.
 *
 * ONE ITEM PER SCREEN. A wall of eight questions is intimidating on a phone, and
 * intimidation costs participation, which is the input this whole instrument runs
 * on. Match and cloze are already multi-part items, so they stay whole; a reading
 * question carries its passage so the text stays on screen while it is answered.
 *
 * The step list is derived from the form, never stored — but the ITEM IDS in
 * order are frozen onto the attempt as `itemSnapshot`, so a later content edit
 * cannot change what a past student was asked.
 */

export interface Step {
  index: number;
  item: Item;
  block: FormBlock["block"];
  blockTitle: string;
  instruction: string;
  passage?: FormBlock["passage"];
  audio?: FormBlock["audio"];
  /** 1-based position within this block, and the block's size, for "2 de 6". */
  posInBlock: number;
  blockSize: number;
}

export function buildSteps(form: Form): Step[] {
  const steps: Step[] = [];
  for (const block of form.blocks) {
    block.items.forEach((item, i) => {
      steps.push({
        index: steps.length,
        item,
        block: block.block,
        blockTitle: block.title,
        instruction: block.instruction,
        passage: block.passage,
        audio: block.audio,
        posInBlock: i + 1,
        blockSize: block.items.length,
      });
    });
  }
  return steps;
}

export function snapshotOf(form: Form): string[] {
  return buildSteps(form).map((s) => s.item.id);
}

/**
 * Rebuilds the step list a past attempt actually saw, from its snapshot.
 *
 * Falls back to the current form for any id it cannot find — an item deleted from
 * the bank must not make an old attempt unopenable, and the response rows carry
 * the real answers regardless.
 */
export function stepsFromSnapshot(form: Form, snapshot: string[]): Step[] {
  const current = buildSteps(form);
  const byId = new Map(current.map((s) => [s.item.id, s]));
  const ordered = snapshot.map((id) => byId.get(id)).filter((s): s is Step => Boolean(s));
  return ordered.length === snapshot.length
    ? ordered.map((s, i) => ({ ...s, index: i }))
    : current;
}
