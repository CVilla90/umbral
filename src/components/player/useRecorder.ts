"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Microphone capture for the speaking items.
 *
 * Three things this deliberately does:
 *
 *   - **Stops itself** at `maxSeconds`. That cap is the client half of the PLAN §7
 *     ceiling (the server re-checks bytes, which is the half that actually binds).
 *   - **Releases the microphone track** the moment a clip ends. A live mic
 *     indicator that stays on after a question is answered is alarming, and this
 *     is a check-in students take in a corridor on a personal phone.
 *   - **Distinguishes "denied" from "unsupported" from "no device"**, because
 *     those three need different sentences, and because `skipReason` records
 *     `permission_denied` separately from `no_mic` (PLAN §2.4) — a distinction
 *     that is free now and unrecoverable later.
 */

export type RecorderState =
  | "idle"
  | "requesting"
  | "recording"
  | "ready"
  | "denied"
  | "unsupported";

/** Ordered by preference; the first supported one wins. Must stay a subset of the
 *  server's `ACCEPTED_AUDIO_MIME`, or a clip is recorded and then rejected. */
const CANDIDATE_MIME = ["audio/webm", "audio/mp4", "audio/ogg"];

function pickMime(): string | null {
  if (typeof MediaRecorder === "undefined") return null;
  for (const mime of CANDIDATE_MIME) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return null;
}

export interface Recording {
  blob: Blob;
  ms: number;
}

export function useRecorder(maxSeconds: number) {
  const [state, setState] = useState<RecorderState>("idle");
  const [recording, setRecording] = useState<Recording | null>(null);
  /** Whole seconds elapsed — drives the countdown ring, nothing else. */
  const [elapsed, setElapsed] = useState(0);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const startedAtRef = useRef(0);
  const stopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (stopTimerRef.current) clearTimeout(stopTimerRef.current);
    if (tickRef.current) clearInterval(tickRef.current);
    stopTimerRef.current = null;
    tickRef.current = null;
  }, []);

  // A student who navigates away mid-recording must not leave the mic open.
  useEffect(() => releaseStream, [releaseStream]);

  const stop = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  const start = useCallback(async () => {
    const mime = pickMime();
    if (!mime || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      return;
    }

    setState("requesting");
    setRecording(null);
    setElapsed(0);

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (error) {
      // NotAllowedError is a refusal; NotFoundError is a laptop with no mic. The
      // caller maps these onto different `skipReason` values.
      const name = (error as DOMException)?.name;
      setState(name === "NotFoundError" || name === "OverconstrainedError" ? "unsupported" : "denied");
      return;
    }

    streamRef.current = stream;
    chunksRef.current = [];
    const recorder = new MediaRecorder(stream, { mimeType: mime });
    recorderRef.current = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      const ms = Date.now() - startedAtRef.current;
      const blob = new Blob(chunksRef.current, { type: mime });
      releaseStream();
      // A blob under a few hundred bytes is a container header with no audio in
      // it — treat it as nothing recorded rather than sending it to be
      // transcribed, which would spend a try to be told it was silent.
      if (blob.size < 512) {
        setState("idle");
        setRecording(null);
        return;
      }
      setRecording({ blob, ms });
      setState("ready");
    };

    startedAtRef.current = Date.now();
    recorder.start();
    setState("recording");

    tickRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000));
    }, 250);
    stopTimerRef.current = setTimeout(stop, maxSeconds * 1000);
  }, [maxSeconds, releaseStream, stop]);

  const reset = useCallback(() => {
    releaseStream();
    setRecording(null);
    setElapsed(0);
    setState("idle");
  }, [releaseStream]);

  return { state, recording, elapsed, start, stop, reset };
}
