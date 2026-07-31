/**
 * What we say while Gemini transcribes, and when.
 *
 * Transcription is usually 1–3 s but genuinely reaches tens of seconds on the
 * free tier. A control that says nothing for forty seconds has, from the
 * student's side, crashed — and the reasonable thing to do about a crashed page
 * is exactly the thing that loses their answer. So the wait escalates: each
 * message is a promise that the previous one was not the final word.
 *
 * Only the last message gives an instruction, because it is the only point at
 * which a student is plausibly reaching for the reload button.
 *
 * Spanish, like all Umbral chrome (PLAN §8) — English here would tax the
 * level-1 student hardest at the moment they are most anxious.
 */
export const WAIT_MESSAGES: { afterSeconds: number; text: string }[] = [
  { afterSeconds: 0, text: "Escuchando tu respuesta…" },
  { afterSeconds: 8, text: "Seguimos trabajando…" },
  { afterSeconds: 20, text: "Ya casi…" },
  {
    afterSeconds: 35,
    text: "Está tardando más de lo normal. No cierres esta pantalla.",
  },
];

/**
 * The message for a given wait. Scans from the end so the LAST matching
 * threshold wins, which is what makes the list read top-to-bottom in the order a
 * student meets it — the property a future edit is most likely to break.
 */
export function waitMessage(seconds: number): string {
  for (let i = WAIT_MESSAGES.length - 1; i >= 0; i--) {
    if (seconds >= WAIT_MESSAGES[i].afterSeconds) return WAIT_MESSAGES[i].text;
  }
  return WAIT_MESSAGES[0].text;
}

/** Below this, the wait is ordinary and no counter is shown. */
export const SHOW_COUNTER_AFTER_SECONDS = 8;

/**
 * The client's own backstop, deliberately LONGER than the server's 45 s
 * `TRANSCRIBE_DEADLINE_MS`.
 *
 * The server should almost always be the one to give up first, because only it
 * can say why, record the failed call against the quota, and leave the student
 * their remaining try. This covers the case the server cannot: a stalled upload
 * from a phone that walked out of signal, where no response is ever coming and
 * the client is the only one that knows. `waiting.test.ts` locks the ordering.
 */
export const CLIENT_TIMEOUT_MS = 60_000;
