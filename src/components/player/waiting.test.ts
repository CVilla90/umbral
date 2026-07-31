import { describe, expect, it } from "vitest";
import { CALL_TIMEOUT_MS, TRANSCRIBE_DEADLINE_MS } from "@/lib/ai/gemini";
import {
  CLIENT_TIMEOUT_MS,
  SHOW_COUNTER_AFTER_SECONDS,
  WAIT_MESSAGES,
  waitMessage,
} from "./waiting";

describe("waitMessage", () => {
  it("starts on the first message", () => {
    expect(waitMessage(0)).toBe(WAIT_MESSAGES[0].text);
  });

  it("escalates in the authored order and never skips backwards", () => {
    // The property that matters: as the wait grows the message index only ever
    // increases. A mis-sorted WAIT_MESSAGES would still "work" for some inputs
    // and produce a message that goes BACKWARDS for others, which is the kind of
    // thing nobody notices until a student is watching it.
    const seen = Array.from({ length: 60 }, (_, s) =>
      WAIT_MESSAGES.findIndex((m) => m.text === waitMessage(s)),
    );
    for (let i = 1; i < seen.length; i++) {
      expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]);
    }
    expect(seen[0]).toBe(0);
    expect(seen[seen.length - 1]).toBe(WAIT_MESSAGES.length - 1);
  });

  it("switches exactly ON each threshold, not one second late", () => {
    for (const m of WAIT_MESSAGES) {
      expect(waitMessage(m.afterSeconds)).toBe(m.text);
    }
  });

  it("only the last message tells the student to do something", () => {
    // The earlier ones exist to reassure. An instruction at 8 s would read as a
    // warning and invite the reload it is trying to prevent.
    const instructive = WAIT_MESSAGES.filter((m) => /no cierres|no salgas/i.test(m.text));
    expect(instructive).toHaveLength(1);
    expect(instructive[0]).toBe(WAIT_MESSAGES[WAIT_MESSAGES.length - 1]);
  });

  it("shows no counter during an ordinary wait", () => {
    // Umbral is deliberately clock-free (PLAN §13). A counter from second zero
    // would turn a two-second wait into a timed event on the one screen where a
    // student is already self-conscious.
    expect(SHOW_COUNTER_AFTER_SECONDS).toBeGreaterThan(0);
    expect(waitMessage(SHOW_COUNTER_AFTER_SECONDS - 1)).toBe(WAIT_MESSAGES[0].text);
  });
});

describe("timeout budget", () => {
  /**
   * These three numbers live in three files and are only correct RELATIVE to
   * each other. Ordered as below, the server is the one that gives up first —
   * and only the server can explain why, record the failed call, and leave the
   * student their remaining try. Invert any pair and the student gets a bare
   * "no pudimos enviar" for what was actually a clean, diagnosable timeout.
   */
  it("lets the server give up before the client does", () => {
    expect(CALL_TIMEOUT_MS).toBeLessThan(TRANSCRIBE_DEADLINE_MS);
    expect(TRANSCRIBE_DEADLINE_MS).toBeLessThan(CLIENT_TIMEOUT_MS);
  });

  it("leaves room for the fallback model after one call times out", () => {
    // A budget under 2× the per-call timeout would spend everything on the
    // primary and never reach the fallback — which is exactly when a slow
    // primary means the fallback is most needed.
    expect(TRANSCRIBE_DEADLINE_MS).toBeGreaterThanOrEqual(2 * CALL_TIMEOUT_MS);
  });

  it("keeps the whole wait inside what the copy promises", () => {
    // The last wait message appears at 35 s. If the budget could run past the
    // copy, the student would sit on "no cierres esta pantalla" indefinitely
    // with nothing further ever being said.
    const lastCopyAt = WAIT_MESSAGES[WAIT_MESSAGES.length - 1].afterSeconds;
    expect(lastCopyAt * 1000).toBeLessThan(TRANSCRIBE_DEADLINE_MS);
  });
});
