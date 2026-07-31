/**
 * Seeded, reproducible shuffling.
 *
 * WHY THIS EXISTS (PLAN §2.3): the printed exams carry a real defect —
 * `english_test_generator/PLAN.md` §10 measured that in levels 1–3 the correct
 * option is `c` exactly ZERO times and `b` between 59 % and 75 % of the time, so a
 * student who picks `b` every time takes most of the block knowing nothing.
 * Porting the items verbatim would import that. Shuffling per attempt removes it
 * by construction, at no authoring cost, and also defeats answer-sharing between
 * students sitting together.
 *
 * The seed lives on the attempt row, so the exact paper a given student saw can
 * be reconstructed months later for review. A shuffle nobody can reproduce is not
 * auditable, and an instrument that cannot be audited cannot be defended.
 */

/** mulberry32 — small, fast, and identical on every platform. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A seed derived from the attempt seed and an item id, so every item gets its own
 * independent permutation from one stored number. Without mixing in the id, all
 * items on an attempt would be permuted identically and the pattern would be
 * learnable across a row of students.
 */
export function itemSeed(attemptSeed: number, itemId: string): number {
  let h = attemptSeed >>> 0;
  for (let i = 0; i < itemId.length; i++) {
    h = Math.imul(h ^ itemId.charCodeAt(i), 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Fisher–Yates against a seeded generator. Returns a new array. */
export function shuffled<T>(items: readonly T[], seed: number): T[] {
  const out = [...items];
  const next = rng(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * The permutation for a multiple-choice item: `order[displayIndex]` is the index
 * of that option in the item as authored.
 *
 * Returning a permutation rather than a reordered array is deliberate — the
 * stored `correct` index and the stored response both stay in AUTHORED space, so
 * changing the shuffle later can never invalidate historical responses.
 */
export function optionOrder(count: number, seed: number): number[] {
  return shuffled(
    Array.from({ length: count }, (_, i) => i),
    seed,
  );
}

/** Where the authored option `authoredIndex` appears on screen. */
export function displayIndexOf(order: number[], authoredIndex: number): number {
  return order.indexOf(authoredIndex);
}
