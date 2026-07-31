"use client";

import { useEffect, useState } from "react";
import type { ClientStep } from "./types";
import Stem from "./Stem";
import { useRecorder } from "./useRecorder";
import {
  CLIENT_TIMEOUT_MS,
  SHOW_COUNTER_AFTER_SECONDS,
  waitMessage,
} from "./waiting";

/**
 * Seconds elapsed since `startedAt` (a timestamp, or 0 when nothing is running).
 *
 * Derived from two clock readings rather than an incrementing counter, so a phone
 * that throttles timers in a backgrounded tab reports the real wait instead of an
 * undercount — which matters here, because the wait *is* the thing being
 * communicated.
 *
 * The clamp covers both moments the subtraction is negative: before the first
 * tick, and on a second send while `now` still holds the previous run's reading.
 */
function useElapsedSeconds(startedAt: number): number {
  const [now, setNow] = useState(0);

  useEffect(() => {
    if (!startedAt) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return 0;
  return Math.max(0, Math.floor((now - startedAt) / 1000));
}

/**
 * A spoken answer: record, send, see what we heard.
 *
 * **What this screen never shows is the point of its design.** It does not say
 * "correct" or "incorrect", and the server does not send that (see the header of
 * `api/speaking/analyze/route.ts`). It shows the transcript, because a student is
 * entitled to know their microphone worked — and because that is exactly what the
 * one retry is for. A retry offered against a right/wrong verdict would be an
 * answer oracle, and the speaking score would start measuring persistence.
 *
 * Everything degrades to "you can continue": no microphone, denied permission, an
 * unsupported browser and a Gemini outage all end on a sentence that points at the
 * Siguiente button. An unanswered speaking item scores 0 (PLAN §2.4), which is the
 * agreed rule, and a student stuck fighting this screen would abandon the other
 * 35 points too.
 */

interface Analysis {
  transcript: string;
  heard: boolean;
  triesRemaining: number;
}

export default function Speaking({
  step,
  attemptId,
  onDone,
}: {
  step: ClientStep;
  attemptId: string;
  onDone: (v: unknown) => void;
}) {
  const maxSeconds = step.maxSeconds ?? 20;
  const { state, recording, elapsed, start, stop, reset } = useRecorder(maxSeconds);

  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  // One piece of state, not two: the send is in flight exactly while we have a
  // start time for it, so "am I sending?" and "for how long?" cannot disagree.
  const [startedAt, setStartedAt] = useState(0);
  const sending = startedAt > 0;
  const waited = useElapsedSeconds(startedAt);

  async function send() {
    if (!recording) return;
    setStartedAt(Date.now());
    setError(null);

    const body = new FormData();
    body.append("attemptId", attemptId);
    body.append("itemId", step.id);
    body.append("ms", String(recording.ms));
    body.append("audio", recording.blob, "clip");

    const controller = new AbortController();
    const bail = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const res = await fetch("/api/speaking/analyze", {
        method: "POST",
        body,
        signal: controller.signal,
      });
      const data = await res.json();
      if (data.ok) {
        const next: Analysis = {
          transcript: data.transcript ?? "",
          heard: Boolean(data.heard),
          triesRemaining: data.triesRemaining ?? 0,
        };
        setAnalysis(next);
        onDone(next);
      } else {
        setError(data.message ?? "Algo salió mal. Puedes continuar.");
        // A refusal that consumed a try must not leave a Reintentar button that
        // will only refuse again.
        if (typeof data.triesRemaining === "number" && data.triesRemaining <= 0) {
          setAnalysis({ transcript: "", heard: false, triesRemaining: 0 });
        }
      }
    } catch (e) {
      setError(
        (e as Error)?.name === "AbortError"
          ? "Tardó demasiado y lo cancelamos. Puedes grabar otra vez o continuar."
          : "No pudimos enviar el audio. Revisa tu conexión o continúa.",
      );
    } finally {
      clearTimeout(bail);
      setStartedAt(0);
      reset();
    }
  }

  return (
    <div>
      <Stem>{step.stem}</Stem>

      <div className="mt-6 rounded-[3px] border border-rule bg-card p-6">
        {/* One live region for the whole control, so a screen reader announces
            state changes once instead of racing several. */}
        <div aria-live="polite">
          {sending ? (
            <Waiting seconds={waited} />
          ) : analysis ? (
            <Heard analysis={analysis} />
          ) : state === "denied" ? (
            <Note>
              No nos diste acceso al micrófono. Puedes activarlo en los permisos de
              tu navegador, o continuar sin grabar.
            </Note>
          ) : state === "unsupported" ? (
            <Note>
              Tu navegador o tu dispositivo no permite grabar aquí. Puedes
              continuar sin grabar.
            </Note>
          ) : state === "recording" ? (
            <Recording elapsed={elapsed} maxSeconds={maxSeconds} />
          ) : state === "ready" ? (
            <p className="text-graphite">
              Listo. Envíalo para que lo escuchemos, o grábalo otra vez.
            </p>
          ) : (
            <p className="text-graphite">
              Toca el botón y responde en voz alta. Tienes hasta {maxSeconds}{" "}
              segundos.
            </p>
          )}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          {state === "recording" && (
            <Primary onClick={stop}>Detener</Primary>
          )}

          {/* Nothing to press while we wait. The old disabled "Escuchando…"
              button said the same thing as the wait state above it, and a
              greyed-out button is a weaker "please wait" than a moving bar. */}
          {state === "ready" && !analysis && !sending && (
            <>
              <Primary onClick={send}>Enviar</Primary>
              <Secondary onClick={reset}>Grabar otra vez</Secondary>
            </>
          )}

          {(state === "idle" || state === "requesting") && !analysis && !sending && (
            <Primary onClick={start} disabled={state === "requesting"}>
              {state === "requesting" ? "Permitiendo…" : "Grabar"}
            </Primary>
          )}

          {analysis && analysis.triesRemaining > 0 && (
            <Secondary
              onClick={() => {
                setAnalysis(null);
                setError(null);
                reset();
              }}
            >
              Grabar otra vez ({analysis.triesRemaining} restante
              {analysis.triesRemaining === 1 ? "" : "s"})
            </Secondary>
          )}
        </div>

        {error && <p className="mt-4 text-sm text-mark-deep">{error}</p>}
      </div>

      <p className="mt-3 text-sm text-graphite">
        Si no puedes grabar, pasa a la siguiente. No pasa nada.
      </p>
    </div>
  );
}

/**
 * The wait.
 *
 * An indeterminate sweep rather than a percentage, because we genuinely do not
 * know how long this will take and a fake progress bar that stalls at 90 % is
 * worse than no bar. It reuses the geometry of the Player's real progress bar so
 * the page has one visual language for "something is advancing".
 *
 * The elapsed counter appears only once the wait is already unusual. Showing it
 * from second zero would turn a two-second wait into a timed event, on the one
 * screen in Umbral where a student is already self-conscious — and this whole
 * instrument is deliberately clock-free (PLAN §13).
 */
function Waiting({ seconds }: { seconds: number }) {
  return (
    <div>
      <p className="text-graphite">{waitMessage(seconds)}</p>
      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-rule-soft">
        <div className="anim-sweep h-full w-1/3 rounded-full bg-span" />
      </div>
      {seconds >= SHOW_COUNTER_AFTER_SECONDS && (
        // aria-hidden: the message above is the live announcement. A counter in
        // the live region would interrupt a screen reader every second.
        <p aria-hidden className="mt-3 font-mono text-sm text-graphite">
          {seconds}s
        </p>
      )}
    </div>
  );
}

function Heard({ analysis }: { analysis: Analysis }) {
  if (!analysis.heard) {
    return (
      <Note>
        No alcanzamos a escuchar nada. Revisa que el micrófono no esté tapado y,
        si quieres, grábalo otra vez.
      </Note>
    );
  }
  return (
    <div>
      <p className="label text-graphite">Escuchamos</p>
      <p className="mt-2 text-lg leading-relaxed">
        &ldquo;{analysis.transcript}&rdquo;
      </p>
      <p className="mt-3 text-sm text-graphite">
        Si eso no es lo que dijiste, grábalo otra vez.
      </p>
    </div>
  );
}

/** The countdown is the ONE clock in Umbral, and it is a recording limit rather
 *  than a deadline on thinking — the student has already decided what to say. */
function Recording({ elapsed, maxSeconds }: { elapsed: number; maxSeconds: number }) {
  const left = Math.max(0, maxSeconds - elapsed);
  return (
    <div className="flex items-center gap-3">
      <span className="h-3 w-3 shrink-0 rounded-full bg-mark" />
      <p className="text-graphite">
        Grabando… quedan <span className="font-mono text-ink">{left}s</span>
      </p>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-graphite">{children}</p>;
}

function Primary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="font-display min-h-12 rounded-[3px] bg-mark px-6 py-3 text-base font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep disabled:opacity-60"
    >
      {children}
    </button>
  );
}

function Secondary({
  children,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      // Same 44px tap target as the Player's skip link, for the same reason:
      // these are pressed on a phone, one-handed, by someone slightly nervous.
      className="inline-flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink disabled:opacity-60"
    >
      {children}
    </button>
  );
}
