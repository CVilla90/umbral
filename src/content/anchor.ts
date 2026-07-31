import type { McqItem } from "@/lib/types";

/**
 * THE ANCHOR — the cross-level ruler (PLAN §2.2).
 *
 * Eight items on every form, at every level, ascending A1 → B2. This is the only
 * mechanism that puts an English-1 score and an English-4 score on one scale, and
 * therefore the only thing that can answer "did English 1 deliver the students
 * English 2 expects?".
 *
 * MATCHED PAIRS, NOT A SHARED POOL. `ANCHOR_A[k]` and `ANCHOR_B[k]` test the same
 * structure in the same CEFR band. A student meets one set at entry and the other
 * at exit, so they never see an anchor item twice — if they did, practice would
 * inflate the exact ruler being used to measure their growth, which is the one
 * measurement error this instrument cannot tolerate.
 *
 * DELIBERATELY LEVEL-AGNOSTIC. These are not drawn from any course syllabus. An
 * item that belonged to a level would advantage that level's students and destroy
 * the comparison.
 *
 * READ BEFORE EDITING:
 *  - Adding an item to one array without its twin in the other silently breaks
 *    equating. `bank.test.ts` fails the build if the bands stop matching.
 *  - Correct answers sit in varied positions here, but nothing depends on that:
 *    options are shuffled per attempt from a stored seed (PLAN §2.3).
 *  - Every structure below is testable in the STEM, never in a result clause —
 *    the trap that produced two defensible answers on levels 3 and 4 of the
 *    printed exams (`english_test_generator/PLAN.md` §6b, §6c).
 *
 * LIMITATION, ON THE RECORD: eight items is a cohort-level ruler. Group means over
 * ~100 students are stable; one student's anchor score has a confidence interval
 * far too wide to label them "B1". Never print a CEFR band next to a name.
 */

export type Band = "A1" | "A2" | "B1" | "B2";

export interface AnchorItem extends McqItem {
  band: Band;
}

const A: AnchorItem[] = [
  {
    id: "anc-a1",
    type: "mcq",
    points: 1,
    band: "A1",
    tag: "to be — present",
    stem: "My sister ______ a nurse at the hospital.",
    choices: ["are", "is", "am"],
    correct: 1,
  },
  {
    id: "anc-a2",
    type: "mcq",
    points: 1,
    band: "A1",
    tag: "have — present",
    stem: "I ______ two younger brothers.",
    choices: ["have", "has", "haves"],
    correct: 0,
  },
  {
    id: "anc-a3",
    type: "mcq",
    points: 1,
    band: "A2",
    tag: "simple past — irregular",
    stem: "We ______ to the beach last summer.",
    choices: ["goed", "go", "went"],
    correct: 2,
  },
  {
    id: "anc-a4",
    type: "mcq",
    points: 1,
    band: "A2",
    tag: "comparative — long adjective",
    stem: "This book is ______ than the other one.",
    choices: ["more interesting", "interestinger", "most interesting"],
    correct: 0,
  },
  {
    id: "anc-a5",
    type: "mcq",
    points: 1,
    band: "B1",
    tag: "present perfect + since",
    stem: "I ______ in this city since 2019.",
    choices: ["am living", "live", "have lived"],
    correct: 2,
  },
  {
    id: "anc-a6",
    // The if-clause is blanked, never the result clause: "If it rains we'll stay"
    // and "if it rained we'd stay" are both correct, so only the if-clause has a
    // single defensible answer.
    type: "mcq",
    points: 1,
    band: "B1",
    tag: "first conditional — if-clause",
    stem: "If it ______ tomorrow, we will stay at home.",
    choices: ["will rain", "rains", "would rain"],
    correct: 1,
  },
  {
    id: "anc-a7",
    type: "mcq",
    points: 1,
    band: "B2",
    tag: "reported speech — backshift",
    stem: "She said she ______ the report the day before.",
    choices: ["has finished", "had finished", "finishes"],
    correct: 1,
  },
  {
    id: "anc-a8",
    type: "mcq",
    points: 1,
    band: "B2",
    tag: "passive — simple past",
    stem: "The bridge ______ in 1998 by a local company.",
    choices: ["was built", "has built", "built"],
    correct: 0,
  },
];

const B: AnchorItem[] = [
  {
    id: "anc-b1",
    type: "mcq",
    points: 1,
    band: "A1",
    tag: "to be — present",
    stem: "My parents ______ teachers at a primary school.",
    choices: ["is", "are", "am"],
    correct: 1,
  },
  {
    id: "anc-b2",
    type: "mcq",
    points: 1,
    band: "A1",
    tag: "have — present",
    stem: "She ______ a new phone.",
    choices: ["haves", "have", "has"],
    correct: 2,
  },
  {
    id: "anc-b3",
    type: "mcq",
    points: 1,
    band: "A2",
    tag: "simple past — irregular",
    stem: "He ______ his keys at the gym yesterday.",
    choices: ["lost", "losed", "lose"],
    correct: 0,
  },
  {
    id: "anc-b4",
    type: "mcq",
    points: 1,
    band: "A2",
    tag: "comparative — short adjective",
    stem: "Today is ______ than yesterday.",
    choices: ["more hot", "hotter", "hottest"],
    correct: 1,
  },
  {
    id: "anc-b5",
    type: "mcq",
    points: 1,
    band: "B1",
    tag: "present perfect + for",
    stem: "She ______ at that company for five years.",
    choices: ["works", "is working", "has worked"],
    correct: 2,
  },
  {
    id: "anc-b6",
    // Same rule as anc-a6: the if-clause carries the test, because
    // "If I had more time, I would travel" and "...I will travel" differ only in
    // the if-clause's defensibility.
    type: "mcq",
    points: 1,
    band: "B1",
    tag: "second conditional — if-clause",
    stem: "If I ______ more free time, I would travel much more.",
    choices: ["had", "will have", "have"],
    correct: 0,
  },
  {
    id: "anc-b7",
    type: "mcq",
    points: 1,
    band: "B2",
    tag: "reported speech — backshift",
    stem: "He told me he ______ never been to Paris.",
    choices: ["was", "has", "had"],
    correct: 2,
  },
  {
    id: "anc-b8",
    type: "mcq",
    points: 1,
    band: "B2",
    tag: "passive — present perfect",
    stem: "The results ______ already been published on the website.",
    choices: ["have", "has", "are"],
    correct: 0,
  },
];

export const ANCHOR: Record<"A" | "B", AnchorItem[]> = { A, B };

/** Band of an anchor item id, for the dashboard's item analysis. */
export function anchorBand(id: string): Band | null {
  const item = [...A, ...B].find((i) => i.id === id);
  return item?.band ?? null;
}
