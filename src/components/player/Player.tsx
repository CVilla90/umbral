"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { saveResponse, finishAttempt } from "@/app/prueba/actions";
import type { ClientStep } from "./types";
import Question from "./Question";

/**
 * The check-in itself.
 *
 * Deliberately absent, and all three are decisions rather than omissions
 * (PLAN §13): no countdown, no copy-paste blocking, no reconnection limit. Time
 * is MEASURED — `msElapsed` per item — and never enforced. Students read a
 * running clock as a threat, and this instrument needs them relaxed enough to
 * show what they actually know.
 *
 * Every answer is saved as it is given, so closing the tab loses nothing.
 */
export default function Player({
  attemptId,
  steps,
  startIndex,
  answered,
}: {
  attemptId: string;
  steps: ClientStep[];
  startIndex: number;
  answered: string[];
}) {
  const [index, setIndex] = useState(startIndex);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [seen, setSeen] = useState<Set<string>>(new Set(answered));
  const [pending, startTransition] = useTransition();
  // Set in the effect below, never during render — reading the clock while
  // rendering makes the component non-idempotent, and React may render twice.
  const enteredAt = useRef(0);

  const step = steps[index];
  const isLast = index === steps.length - 1;
  const value = answers[step.id];

  useEffect(() => {
    enteredAt.current = Date.now();
  }, [index]);

  const persist = useCallback(
    async (skipped: boolean) => {
      const msElapsed = enteredAt.current ? Date.now() - enteredAt.current : 0;
      const v = answers[step.id];

      await saveResponse({
        attemptId,
        itemId: step.id,
        msElapsed,
        skipped,
        skipReason: skipped ? "chose_skip" : null,
        displayIndex: step.type === "mcq" ? ((v as number | undefined) ?? null) : undefined,
        boolValue: step.type === "tf" ? ((v as boolean | undefined) ?? null) : undefined,
        textValue: step.type === "open" ? ((v as string | undefined) ?? "") : undefined,
        mapValue:
          step.type === "match" || step.type === "gap"
            ? ((v as Record<string, string> | undefined) ?? {})
            : undefined,
      });
      setSeen((s) => new Set(s).add(step.id));
    },
    [answers, attemptId, step],
  );

  const advance = (skipped: boolean) => {
    startTransition(async () => {
      await persist(skipped);
      if (isLast) {
        await finishAttempt(attemptId);
      } else {
        setIndex((i) => i + 1);
      }
    });
  };

  const answeredCount = seen.size;

  return (
    <div className="flex min-h-[70vh] flex-col">
      <Progress done={answeredCount} total={steps.length} />

      <div className="mt-8 flex-1">
        <div className="flex items-baseline justify-between gap-4">
          <p className="label text-graphite">{step.blockTitle}</p>
          <p className="label text-rule">
            {step.posInBlock} / {step.blockSize}
          </p>
        </div>
        <p className="mt-2 text-sm text-graphite">{step.instruction}</p>

        <div className="mt-8">
          <Question
            key={step.id}
            step={step}
            value={value}
            onChange={(v) => setAnswers((a) => ({ ...a, [step.id]: v }))}
            attemptId={attemptId}
          />
        </div>
      </div>

      <div className="mt-12 flex items-center gap-6 border-t border-rule pt-6">
        <button
          type="button"
          onClick={() => advance(false)}
          disabled={pending}
          className="font-display rounded-[3px] bg-mark px-8 py-3.5 text-base font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep disabled:opacity-60"
        >
          {pending ? "Guardando…" : isLast ? "Terminar" : "Siguiente"}
        </button>

        {/* Skipping is always allowed and always costs the point. Making a
            student fight the interface for a question they cannot answer is how
            you lose the rest of their answers too. */}
        {/* `min-h-11` without a background: the tap target is 44px, the thing
            you see is still a quiet text link. It measured 20px, which on a phone
            is a control you stab at twice — and the second stab lands on
            Siguiente, submitting a blank answer the student meant to skip
            deliberately. Growing it downward rather than sideways keeps it from
            competing with the primary button. */}
        <button
          type="button"
          onClick={() => advance(true)}
          disabled={pending}
          className="inline-flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink disabled:opacity-60"
        >
          No sé, pasar
        </button>
      </div>
    </div>
  );
}

/**
 * A progress bar, not a clock. It answers "how much is left", which reduces
 * anxiety, without ever answering "how fast am I going", which creates it.
 */
function Progress({ done, total }: { done: number; total: number }) {
  const width = total ? Math.round((done / total) * 100) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span className="label text-graphite">Tu avance</span>
        <span className="label text-graphite">
          {done} de {total}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-rule-soft">
        <div
          className="h-full rounded-full bg-span transition-[width] duration-500 ease-out"
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
