import type { FormBlock, FormId, McqItem } from "@/lib/types";

/**
 * The listening block: 4 levels × 2 forms × 3 items = 24 clips (PLAN §3.2, §3.3).
 *
 * Hand-authored here rather than exported from `english_test_generator`, because
 * the printed exams have no listening section — this is one of only two genuinely
 * new pieces of content in Umbral, the other being the anchor.
 *
 * Four rules held while writing these:
 *
 *   1. **The answer is only in the audio.** Every distractor is a real word from
 *      the clip's world, so a student who cannot hear it cannot reason their way
 *      to the answer from the question stem alone. That is what makes this
 *      measure listening rather than plausibility.
 *   2. **A and B are parallel slot for slot**, same structure, same tense load,
 *      same answer position in the clip — the same discipline `PART_I[k]` and
 *      `PRACTICE_MC[k]` already follow, which is what lets counterbalancing
 *      cancel form difficulty at cohort level.
 *   3. **The voice is chosen by SLOT, not by a running counter.** Slot 1 is the
 *      same speaker on form A and form B at every level. A student who drew the
 *      form whose slot 2 happened to be the fastest speaker would be sitting a
 *      harder instrument, and no amount of counterbalancing recovers that.
 *   4. **Original wording, everyday register**, 1–3 sentences, calibrated to the
 *      grammar the level actually teaches.
 *
 * All MCQ, three options, no true/false. The blueprint allows either; MCQ gets the
 * per-attempt option shuffle for free, which is what keeps the inherited
 * answer-letter skew out of the one block that has no printed ancestor to inherit
 * it from. A single TF item per form could not be polarity-balanced within its own
 * block anyway.
 */

/**
 * Rotating voices, indexed by slot. Two women and two men so no level is a single
 * accent, all `en-US` so the variable under test is comprehension and not accent
 * familiarity — these students have had almost no exposure to non-US English, and
 * a British speaker in slot 3 would measure that surprise instead.
 */
export const LISTENING_VOICES = [
  "en-US-AvaMultilingualNeural",
  "en-US-AndrewNeural",
  "en-US-AriaNeural",
] as const;

/**
 * Speech rate per level. Slower at A1 is not charity — an A1 student who fails to
 * catch a native-rate clip has been measured on processing speed rather than on
 * the language they were taught. Identical for A and B at the same level, so it
 * never becomes a form-difficulty difference.
 */
export const LISTENING_RATE: Record<number, string> = {
  1: "-20%",
  2: "-12%",
  3: "-6%",
  4: "+0%",
};

/** One authored clip: the transcript that gets spoken, and the question about it. */
export interface ListeningSpec {
  id: string;
  transcript: string;
  stem: string;
  choices: string[];
  correct: number;
}

type LevelSpecs = Record<FormId, ListeningSpec[]>;

const SPECS: Record<number, LevelSpecs> = {
  // ---------------------------------------------------------------- level 1
  // Inglés I · A1–A2 — present simple, `be`, family, routine, clock time.
  1: {
    A: [
      {
        id: "l1a-li-1",
        transcript: "Hi! My name is Sofía. I'm twenty years old and I study medicine.",
        stem: "What does Sofía study?",
        choices: ["Medicine.", "Law.", "Engineering."],
        correct: 0,
      },
      {
        id: "l1a-li-2",
        transcript:
          "My brother works in a restaurant. He starts at four in the afternoon and he finishes at eleven at night.",
        stem: "When does her brother start work?",
        choices: ["At eleven at night.", "At four in the afternoon.", "At four in the morning."],
        correct: 1,
      },
      {
        id: "l1a-li-3",
        transcript:
          "Today is Wednesday. I have my English class on Monday, Wednesday and Friday.",
        stem: "How many days a week does she have English class?",
        choices: ["Two.", "Five.", "Three."],
        correct: 2,
      },
    ],
    B: [
      {
        id: "l1b-li-1",
        transcript: "Hello! I'm Diego. I'm nineteen years old and I study architecture.",
        stem: "What does Diego study?",
        choices: ["Architecture.", "Business.", "Nursing."],
        correct: 0,
      },
      {
        id: "l1b-li-2",
        transcript:
          "My sister works in a hotel. She starts at seven in the morning and she finishes at three in the afternoon.",
        stem: "When does his sister finish work?",
        choices: ["At seven in the morning.", "At three in the afternoon.", "At three in the morning."],
        correct: 1,
      },
      {
        id: "l1b-li-3",
        transcript: "Today is Thursday. I go to the gym on Tuesday, Thursday and Saturday.",
        stem: "How many days a week does he go to the gym?",
        choices: ["Two.", "Four.", "Three."],
        correct: 2,
      },
    ],
  },

  // ---------------------------------------------------------------- level 2
  // Inglés II · A2–B1 — present continuous, imperatives and directions,
  // comparatives, clothes.
  2: {
    A: [
      {
        id: "l2a-li-1",
        transcript:
          "Look at the man next to the door. He's wearing a blue jacket and he's carrying a big box.",
        stem: "What is the man carrying?",
        choices: ["A blue jacket.", "A big box.", "A small bag."],
        correct: 1,
      },
      {
        id: "l2a-li-2",
        transcript:
          "Go straight for two blocks and turn right at the pharmacy. The bank is next to the cinema.",
        stem: "Where is the bank?",
        choices: ["Next to the cinema.", "Next to the pharmacy.", "In front of the cinema."],
        correct: 0,
      },
      {
        id: "l2a-li-3",
        transcript:
          "I usually take the bus to school, but today I'm walking, because the traffic is terrible.",
        stem: "Why is she walking today?",
        choices: ["The bus is more expensive.", "She likes walking.", "The traffic is very bad."],
        correct: 2,
      },
    ],
    B: [
      {
        id: "l2b-li-1",
        transcript:
          "Look at the woman next to the window. She's wearing a green sweater and she's holding a red umbrella.",
        stem: "What is the woman holding?",
        choices: ["A green sweater.", "A red umbrella.", "A small phone."],
        correct: 1,
      },
      {
        id: "l2b-li-2",
        transcript:
          "Walk straight for three blocks and turn left at the bakery. The library is next to the park.",
        stem: "Where is the library?",
        choices: ["Next to the park.", "Next to the bakery.", "In front of the park."],
        correct: 0,
      },
      {
        id: "l2b-li-3",
        transcript:
          "I usually have lunch at home, but today I'm eating at school, because my classes finish very late.",
        stem: "Why is he eating at school today?",
        choices: ["The food is cheaper.", "He forgot his lunch.", "His classes finish very late."],
        correct: 2,
      },
    ],
  },

  // ---------------------------------------------------------------- level 3
  // Inglés III · B1 — past simple and continuous, present perfect, experiences.
  3: {
    A: [
      {
        id: "l3a-li-1",
        transcript:
          "Last weekend we drove to the mountains. It was raining when we arrived, so we stayed in the car for almost an hour.",
        stem: "What was the weather like when they arrived?",
        choices: ["It was snowing.", "It was sunny.", "It was raining."],
        correct: 2,
      },
      {
        id: "l3a-li-2",
        transcript:
          "I've worked at this hospital for three years. Before that, I was a waiter in my uncle's restaurant.",
        stem: "What did he do before this job?",
        choices: ["He was a waiter.", "He was a cook.", "He was a nurse."],
        correct: 0,
      },
      {
        id: "l3a-li-3",
        transcript:
          "We were watching a movie when the lights suddenly went out. Nobody in the house could find a flashlight.",
        stem: "What were they doing when the lights went out?",
        choices: ["Looking for a flashlight.", "Watching a movie.", "Making dinner."],
        correct: 1,
      },
    ],
    B: [
      {
        id: "l3b-li-1",
        transcript:
          "Last summer we travelled to the coast. It was very windy when we got there, so we ate inside the hotel.",
        stem: "What was the weather like when they got there?",
        choices: ["It was foggy.", "It was warm.", "It was very windy."],
        correct: 2,
      },
      {
        id: "l3b-li-2",
        transcript:
          "I've studied at this university for two years. Before that, I was a receptionist in my aunt's clinic.",
        stem: "What did she do before university?",
        choices: ["She was a receptionist.", "She was a teacher.", "She was a doctor."],
        correct: 0,
      },
      {
        id: "l3b-li-3",
        transcript:
          "They were cooking dinner when the phone suddenly rang. Nobody in the kitchen wanted to answer it.",
        stem: "What were they doing when the phone rang?",
        choices: ["Answering the door.", "Cooking dinner.", "Eating dinner."],
        correct: 1,
      },
    ],
  },

  // ---------------------------------------------------------------- level 4
  // Inglés IV · B1–B2 — past perfect, reported speech, conditionals, future
  // arrangements.
  4: {
    A: [
      {
        id: "l4a-li-1",
        transcript:
          "By the time I got to the station, the train had already left. I had to wait almost two hours for the next one.",
        stem: "Why did he have to wait?",
        choices: ["The station was closed.", "He had lost his ticket.", "The train had already left."],
        correct: 2,
      },
      {
        id: "l4a-li-2",
        transcript:
          "She told me she would call me back that evening, but she never did. If she had called, I would have explained everything.",
        stem: "What did she promise to do?",
        choices: ["Call him back.", "Explain everything.", "Meet him that evening."],
        correct: 0,
      },
      {
        id: "l4a-li-3",
        transcript:
          "I'm meeting the director at nine tomorrow morning, so I won't be able to join you for breakfast.",
        stem: "Why can't he join them for breakfast?",
        choices: ["He is travelling tomorrow.", "He has a meeting.", "He gets up late."],
        correct: 1,
      },
    ],
    B: [
      {
        id: "l4b-li-1",
        transcript:
          "By the time we reached the theatre, the play had already started. We had to wait outside until the interval.",
        stem: "Why did they have to wait outside?",
        choices: ["The theatre was full.", "They had forgotten the tickets.", "The play had already started."],
        correct: 2,
      },
      {
        id: "l4b-li-2",
        transcript:
          "He said he would send me the documents that night, but he never did. If he had sent them, I would have finished the report.",
        stem: "What did he promise to do?",
        choices: ["Send the documents.", "Finish the report.", "Visit her that night."],
        correct: 0,
      },
      {
        id: "l4b-li-3",
        transcript:
          "I'm seeing the dentist at eight tomorrow morning, so I won't be able to drive you to the airport.",
        stem: "Why can't she drive him to the airport?",
        choices: ["Her car is broken.", "She has an appointment.", "She wakes up late."],
        correct: 1,
      },
    ],
  },
};

/** Where a clip lives once generated. `tools/generate_listening.py` writes here. */
export function clipSrc(id: string): string {
  return `/audio/listening/${id}.mp3`;
}

function toItem(spec: ListeningSpec, slot: number): McqItem {
  return {
    id: spec.id,
    type: "mcq",
    points: 1,
    tag: "listening",
    stem: spec.stem,
    choices: spec.choices,
    correct: spec.correct,
    audio: {
      id: spec.id,
      // Kept in the bank so the answer key and the accessibility transcript come
      // from ONE place — but stripped in `toClientStep`, because for a listening
      // item the transcript IS the answer key.
      transcript: spec.transcript,
      src: clipSrc(spec.id),
      voice: LISTENING_VOICES[slot % LISTENING_VOICES.length],
    },
  };
}

export function listeningBlock(level: number, form: FormId): FormBlock | undefined {
  const specs = SPECS[level]?.[form];
  if (!specs) return undefined;
  return {
    block: "listening",
    title: "Escucha",
    instruction: "Escucha el audio y responde. Puedes repetirlo las veces que quieras.",
    items: specs.map(toItem),
  };
}

/** Every spec, for the generator script and the validator. */
export function allListeningSpecs(): { level: number; form: FormId; slot: number; spec: ListeningSpec }[] {
  const out: { level: number; form: FormId; slot: number; spec: ListeningSpec }[] = [];
  for (const level of [1, 2, 3, 4]) {
    for (const form of ["A", "B"] as FormId[]) {
      SPECS[level][form].forEach((spec, slot) => out.push({ level, form, slot, spec }));
    }
  }
  return out;
}
