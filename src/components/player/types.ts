import type { Block, GapSegment, ItemType, Passage } from "@/lib/types";

/**
 * What the client is allowed to know about a question.
 *
 * Note what is NOT here: `correct`, and `accepted`. The server strips both before
 * sending a step to the browser, so the answers to a live check-in are not
 * sitting in the page source — which they would be if the bank types were reused
 * directly. Choices arrive pre-shuffled and the client reports back the index it
 * displayed; the server maps that to the authored index from the stored seed.
 */
export interface ClientStep {
  id: string;
  type: ItemType;
  block: Block;
  blockTitle: string;
  instruction: string;
  posInBlock: number;
  blockSize: number;

  stem?: string;
  /** Already shuffled for this attempt. */
  choices?: string[];
  sentence?: string;
  passage?: Passage;

  /** Listening: the clip URL, and NOTHING else from the `AudioClip`.
   *
   *  The transcript is deliberately absent. For a listening item the transcript is
   *  the answer key — shipping it alongside the question would put the answer in
   *  the page source of a live check-in, which is the exact failure `toClientStep`
   *  exists to prevent for `correct` and `accepted`. */
  audioSrc?: string;

  /** Match: left labels in order, right labels shuffled independently. */
  lefts?: string[];
  rights?: string[];

  /** Cloze: `answer` and `accepted` are stripped from blank segments. */
  wordBank?: string[];
  segments?: ClientSegment[];

  maxSeconds?: number;
}

export type ClientSegment =
  | { kind: "text"; value: string }
  | { kind: "blank"; n: number }
  | { kind: "filled"; value: string };

export type { GapSegment };
