"use client";

import { useActionState } from "react";
import { saveFicha, type FichaError } from "@/app/ficha/actions";

/**
 * The ficha. Untimed, unscored, and the first thing a student sees after signing
 * in — so it is also where the tone of the whole instrument gets set. Plain
 * language, nothing marked "required" with an asterisk, and the two fields the
 * server already knows are shown greyed rather than hidden, because a student who
 * can see their own email and today's date knows exactly what is being recorded.
 */

const GROUPS = ["A", "B", "C", "D", "E", "F", "G"];
const LEVELS = [1, 2, 3, 4];

export default function FichaForm({
  email,
  today,
  suggestedName,
  professors,
  initial,
}: {
  email: string;
  today: string;
  suggestedName: string;
  professors: { id: string; name: string }[];
  initial?: {
    fullName: string;
    matricula: string;
    age: number | null;
    gender: string | null;
    academicSemester: number;
    group: string;
    englishLevel: number;
    professorRaw: string | null;
  } | null;
}) {
  const [error, action, pending] = useActionState<FichaError | null, FormData>(
    saveFicha,
    null,
  );
  const err = (k: string) => error?.fields?.[k];

  return (
    <form action={action} className="space-y-10">
      <section className="grid gap-px overflow-hidden rounded-[3px] bg-rule sm:grid-cols-2">
        <Locked label="Tu correo" value={email} />
        <Locked label="Fecha" value={today} />
      </section>

      <section className="space-y-6">
        <Field label="¿Cómo te llamas?" error={err("fullName")}>
          <input
            name="fullName"
            defaultValue={initial?.fullName ?? suggestedName}
            autoComplete="name"
            className={input}
            placeholder="Nombre y apellidos"
          />
        </Field>

        <Field label="Tu matrícula" error={err("matricula")}>
          <input
            name="matricula"
            defaultValue={initial?.matricula ?? ""}
            // Uppercase the value the student types, but not the example — an
            // uppercased placeholder reads as SHOUTING, not as a hint.
            className={`${input} uppercase placeholder:normal-case`}
            placeholder="Por ejemplo, 349021"
            inputMode="text"
          />
        </Field>

        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Semestre que cursas" error={err("academicSemester")}>
            <select
              name="academicSemester"
              defaultValue={initial?.academicSemester ?? ""}
              className={input}
            >
              <option value="">Elige…</option>
              {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Tu grupo" error={err("group")}>
            <select name="group" defaultValue={initial?.group ?? ""} className={input}>
              <option value="">Elige…</option>
              {GROUPS.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </Field>
        </div>
      </section>

      {/* The load-bearing field: it decides which of the four instruments is
          served, so it gets the most visual weight on the page and is asked as a
          choice rather than buried in a dropdown. */}
      <Field
        label="¿Qué inglés estás cursando ahora?"
        hint="Esto decide las preguntas que vas a ver."
        error={err("englishLevel")}
      >
        <div className="mt-1 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {LEVELS.map((n) => (
            <label key={n} className="cursor-pointer">
              <input
                type="radio"
                name="englishLevel"
                value={n}
                defaultChecked={initial?.englishLevel === n}
                className="peer sr-only"
              />
              <span className="font-display flex h-20 items-center justify-center rounded-[3px] border border-rule bg-card text-2xl font-extrabold transition-colors peer-checked:border-mark peer-checked:bg-mark peer-checked:text-on-mark peer-focus-visible:outline-2 peer-focus-visible:outline-offset-3 peer-focus-visible:outline-mark">
                Inglés {n}
              </span>
            </label>
          ))}
        </div>
      </Field>

      <section className="space-y-6">
        <div className="grid gap-6 sm:grid-cols-2">
          <Field label="Edad" optional error={err("age")}>
            <input
              name="age"
              type="number"
              min={15}
              max={80}
              defaultValue={initial?.age ?? ""}
              className={input}
              placeholder="20"
            />
          </Field>

          <Field label="Género" optional>
            <select name="gender" defaultValue={initial?.gender ?? ""} className={input}>
              <option value="">Prefiero no decir</option>
              <option value="F">Femenino</option>
              <option value="M">Masculino</option>
              <option value="O">Otro</option>
            </select>
          </Field>
        </div>

        <Field
          label="Profesor o profesora"
          optional
          hint="Si no te acuerdas, déjalo en blanco. Lo podemos completar después."
        >
          {professors.length ? (
            <select name="professorRaw" defaultValue={initial?.professorRaw ?? ""} className={input}>
              <option value="">No sé / no aparece</option>
              {professors.map((p) => (
                <option key={p.id} value={p.name}>
                  {p.name}
                </option>
              ))}
            </select>
          ) : (
            <input
              name="professorRaw"
              defaultValue={initial?.professorRaw ?? ""}
              className={input}
              placeholder="Nombre de tu profesor"
            />
          )}
        </Field>
      </section>

      <section className="rounded-[3px] border border-rule bg-card p-5 sm:p-6">
        <label className="flex gap-3 text-[0.95rem] leading-relaxed">
          <input
            type="checkbox"
            name="consent"
            value="1"
            className="mt-1 h-4 w-4 shrink-0 accent-[var(--color-mark)]"
          />
          <span>
            Acepto que mis respuestas se guarden y se usen para estudiar cómo avanza
            el inglés en la Facultad. Los reportes son agregados: no se publica mi
            nombre ni mi resultado individual. Puedo pedir que se borren mis datos
            escribiendo a la Coordinación de Inglés.
          </span>
        </label>
        {err("consent") && <p className="mt-3 text-sm text-mark-deep">{err("consent")}</p>}
      </section>

      {error?.message && (
        <p className="rounded-[3px] bg-mark-soft px-4 py-3 text-sm text-mark-deep">
          {error.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="font-display w-full rounded-[3px] bg-mark px-8 py-4 text-lg font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep disabled:opacity-60 sm:w-auto"
      >
        {pending ? "Guardando…" : "Empezar"}
      </button>
    </form>
  );
}

const input =
  "w-full rounded-[3px] border border-rule bg-card px-4 py-3 text-base outline-none transition-colors focus:border-ink";

function Field({
  label,
  hint,
  optional,
  error,
  children,
}: {
  label: string;
  hint?: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="flex items-baseline gap-2">
        <span className="font-display text-base font-bold">{label}</span>
        {optional && <span className="label text-graphite">opcional</span>}
      </span>
      {hint && <span className="mt-1 block text-sm text-graphite">{hint}</span>}
      <div className="mt-2">{children}</div>
      {error && <span className="mt-2 block text-sm text-mark-deep">{error}</span>}
    </label>
  );
}

/** Server-known values: shown, not editable, so nothing is a surprise later. */
function Locked({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-paper-lift p-5">
      <p className="label text-graphite">{label}</p>
      <p className="mt-1.5 truncate text-graphite" title={value}>
        {value}
      </p>
    </div>
  );
}
