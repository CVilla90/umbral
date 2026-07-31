"use client";

import type { ClientStep } from "./types";
import Speaking from "./Speaking";
import Stem from "./Stem";

/**
 * One question, one screen.
 *
 * Touch targets are large because most of these are answered on a phone in a
 * corridor, and every control is reachable and labelled for a keyboard. Nothing
 * here reveals a correct answer: the props simply do not contain one.
 */
export default function Question({
  step,
  value,
  onChange,
  attemptId,
}: {
  step: ClientStep;
  value: unknown;
  onChange: (v: unknown) => void;
  /** Speaking posts straight to its own route, which needs to re-verify the
   *  attempt server-side; every other type is saved by the Player's action. */
  attemptId: string;
}) {
  return (
    <div className="space-y-6">
      {step.passage && <PassageBox passage={step.passage} />}
      {step.audioSrc && <Clip src={step.audioSrc} />}

      {step.type === "mcq" && (
        <Mcq step={step} value={value as number | undefined} onChange={onChange} />
      )}
      {step.type === "tf" && (
        <Tf step={step} value={value as boolean | undefined} onChange={onChange} />
      )}
      {step.type === "open" && (
        <Open step={step} value={value as string | undefined} onChange={onChange} />
      )}
      {step.type === "match" && (
        <Match step={step} value={value as Record<string, string> | undefined} onChange={onChange} />
      )}
      {step.type === "gap" && (
        <Gap step={step} value={value as Record<string, string> | undefined} onChange={onChange} />
      )}
      {step.type === "speaking" && (
        <Speaking step={step} attemptId={attemptId} onDone={onChange} />
      )}
    </div>
  );
}

/**
 * A listening clip.
 *
 * **Unlimited replays, on purpose.** A play-once rule would measure working
 * memory and nerve rather than comprehension, and it would punish exactly the
 * student taking this on a phone in a noisy corridor — which is most of them.
 * Umbral measures what a student understands, not how well they cope with an
 * artificial constraint (PLAN §13, the same reasoning that removed the timers).
 *
 * Native `<audio controls>` rather than a custom transport: it is keyboard
 * accessible, it is already familiar, and it gives scrubbing back for free.
 */
function Clip({ src }: { src: string }) {
  return (
    <div className="rounded-[3px] border border-rule bg-card p-5">
      <p className="label text-graphite">Audio</p>
      {/* No <track> caption on purpose: the caption would BE the transcript,
          which is the answer key for this item. Accessibility is served instead
          by unlimited replays, native controls, and the fact that a deaf student
          scores 0 on 3 of 37 points rather than being blocked — the same rule
          that lets any item be skipped (PLAN §2.4). */}
      <audio src={src} controls preload="auto" className="mt-3 w-full">
        Tu navegador no puede reproducir audio.
      </audio>
      <p className="mt-3 text-sm text-graphite">
        Puedes escucharlo las veces que quieras.
      </p>
    </div>
  );
}

function PassageBox({ passage }: { passage: NonNullable<ClientStep["passage"]> }) {
  return (
    // Stays on screen with every question about it — scrolling back up to re-read
    // a paragraph is how a reading question turns into a memory question.
    <div className="max-h-64 overflow-y-auto rounded-[3px] border border-rule bg-card p-5 sm:max-h-72">
      <p className="font-display text-base font-bold">{passage.title}</p>
      <div className="mt-3 space-y-3 text-[0.95rem] leading-relaxed text-ink-soft">
        {passage.paragraphs.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>
    </div>
  );
}

function Mcq({
  step,
  value,
  onChange,
}: {
  step: ClientStep;
  value: number | undefined;
  onChange: (v: number) => void;
}) {
  return (
    <fieldset>
      {/* The stem IS the legend. A separate sr-only legend made a screen reader
          announce the question twice before reaching the first option. */}
      <legend>
        <Stem>{step.stem}</Stem>
      </legend>
      <div className="mt-6 space-y-3">
        {(step.choices ?? []).map((choice, i) => (
          <label key={i} className="block cursor-pointer">
            <input
              type="radio"
              name={step.id}
              checked={value === i}
              onChange={() => onChange(i)}
              className="peer sr-only"
            />
            <span className="flex min-h-14 items-center rounded-[3px] border border-rule bg-card px-5 py-3.5 text-base transition-colors peer-checked:border-mark peer-checked:bg-mark-soft peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-mark">
              {choice}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Tf({
  step,
  value,
  onChange,
}: {
  step: ClientStep;
  value: boolean | undefined;
  onChange: (v: boolean) => void;
}) {
  const options: { label: string; v: boolean }[] = [
    { label: "Está bien", v: true },
    { label: "Está mal", v: false },
  ];
  return (
    <fieldset>
      <legend>
        <Stem>&ldquo;{step.sentence}&rdquo;</Stem>
      </legend>
      <div className="mt-6 grid grid-cols-2 gap-3">
        {options.map((o) => (
          <label key={o.label} className="cursor-pointer">
            <input
              type="radio"
              name={step.id}
              checked={value === o.v}
              onChange={() => onChange(o.v)}
              className="peer sr-only"
            />
            <span className="font-display flex h-16 items-center justify-center rounded-[3px] border border-rule bg-card text-base font-bold transition-colors peer-checked:border-mark peer-checked:bg-mark peer-checked:text-on-mark peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-mark">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function Open({
  step,
  value,
  onChange,
}: {
  step: ClientStep;
  value: string | undefined;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <Stem>{step.stem}</Stem>
      <input
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        // Autocorrect off: the grader already folds case, accents and
        // punctuation, but a phone "helpfully" rewriting an English word into a
        // Spanish one would change the answer itself.
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className="mt-6 w-full rounded-[3px] border border-rule bg-card px-5 py-4 text-lg outline-none transition-colors focus:border-ink"
        placeholder="Escribe tu respuesta"
      />
      <p className="mt-3 text-sm text-graphite">
        No te preocupes por mayúsculas ni acentos.
      </p>
    </div>
  );
}

function Match({
  step,
  value,
  onChange,
}: {
  step: ClientStep;
  value: Record<string, string> | undefined;
  onChange: (v: Record<string, string>) => void;
}) {
  const answer = value ?? {};
  const taken = new Set(Object.values(answer).filter(Boolean));

  // No heading here: the block instruction directly above already says "une cada
  // palabra con su definición", and repeating it verbatim as a title reads as a
  // rendering mistake.
  return (
    <div>
      <div className="space-y-4">
        {(step.lefts ?? []).map((left) => (
          <div key={left} className="rounded-[3px] border border-rule bg-card p-4">
            <p className="font-display text-base font-bold">{left}</p>
            {/* ⚠️ `text-base` (16px) is not a typographic choice — it is the fix
                for an iOS Safari behaviour. Any form control under 16px makes
                Safari ZOOM the page on focus, and it does not zoom back out on
                blur, so a student who touches one of these selects spends the
                rest of the check-in scrolling a magnified page sideways. This was
                15.2px and did exactly that. `min-h-11` gets the target to 44px;
                it measured 41px. */}
            <select
              value={answer[left] ?? ""}
              onChange={(e) => onChange({ ...answer, [left]: e.target.value })}
              className="mt-2 min-h-11 w-full rounded-[3px] border border-rule bg-paper-lift px-3 py-2.5 text-base outline-none focus:border-ink"
            >
              <option value="">Elige una definición…</option>
              {(step.rights ?? []).map((right) => (
                <option
                  key={right}
                  value={right}
                  // Every right label is used exactly once (the validator
                  // enforces it), so greying out a taken one is a real hint and
                  // never strands a row.
                  disabled={taken.has(right) && answer[left] !== right}
                >
                  {right}
                </option>
              ))}
            </select>
          </div>
        ))}
      </div>
    </div>
  );
}

function Gap({
  step,
  value,
  onChange,
}: {
  step: ClientStep;
  value: Record<string, string> | undefined;
  onChange: (v: Record<string, string>) => void;
}) {
  const answer = value ?? {};
  // Likewise: the block is already titled "Completa el texto".
  return (
    <div>
      <div className="flex flex-wrap gap-2 rounded-[3px] border border-rule bg-paper-lift p-4">
        {(step.wordBank ?? []).map((w) => (
          // NOT the `.label` class: it uppercases, and capitalisation is part of
          // the answer here — "There is" at the start of a sentence versus
          // "there are" mid-sentence is exactly the cue being tested.
          <span
            key={w}
            className="rounded-[2px] bg-card px-2.5 py-1.5 font-mono text-sm text-graphite"
          >
            {w}
          </span>
        ))}
      </div>

      <p className="mt-6 text-lg leading-[2.6]">
        {(step.segments ?? []).map((seg, i) => {
          if (seg.kind === "text") return <span key={i}>{seg.value}</span>;
          if (seg.kind === "filled")
            return (
              <span key={i} className="text-graphite">
                {seg.value}
              </span>
            );
          return (
            <input
              key={i}
              value={answer[String(seg.n)] ?? ""}
              onChange={(e) => onChange({ ...answer, [String(seg.n)]: e.target.value })}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              aria-label={`Espacio ${seg.n}`}
              className="mx-1 w-32 rounded-[2px] border-b-2 border-mark bg-mark-soft px-2 py-0.5 text-base outline-none focus:bg-card"
            />
          );
        })}
      </p>
    </div>
  );
}

