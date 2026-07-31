"use client";

import { useActionState, useState } from "react";
import { submitRoster, type RosterState } from "./actions";

const INITIAL: RosterState = { status: "idle" };

/**
 * Paste-first, on purpose: the shortest path from a spreadsheet to here is
 * select-all, copy, paste. A file picker is offered too, but pasting works from
 * Google Sheets, from Excel and from a WhatsApp message, and it never involves
 * explaining what "CSV UTF-8" means to a colleague.
 */
export default function RosterForm() {
  const [state, action, pending] = useActionState(submitRoster, INITIAL);
  // ⚠️ CONTROLLED, and it has to be. The textarea was uncontrolled with a
  // `defaultValue` that changed between renders, which makes React reset the
  // field — so the flow this page is built around (Revisar, then Guardar) wiped
  // the text on the first step and answered "Pega la lista primero" on the
  // second. Found by actually clicking both buttons; nothing in the type system
  // or the parser tests could have seen it.
  const [text, setText] = useState("");

  return (
    <form action={action} className="mt-6">
      <label htmlFor="texto" className="label text-graphite">
        Pega la lista
      </label>
      <p className="mt-1 text-sm text-graphite">
        Una fila por alumno: <span className="font-mono">matrícula, nombre, nivel, grupo</span>.
        Sirve con comas, punto y coma o tabuladores, con o sin encabezado.
      </p>
      <textarea
        id="texto"
        name="texto"
        rows={10}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={"349021, Ana Ramírez, 2, B\n349022, Luis Soto, 2, B"}
        className="mt-3 w-full rounded-[3px] border border-rule bg-card px-4 py-3 font-mono text-base outline-none focus:border-ink"
      />

      <div className="mt-4 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          name="intent"
          value="preview"
          disabled={pending}
          className="font-display inline-flex min-h-12 items-center rounded-[3px] border border-ink px-6 text-base font-bold tracking-[-0.005em] transition-colors hover:bg-paper-lift disabled:opacity-60"
        >
          {pending ? "Revisando…" : "Revisar"}
        </button>

        {/* Only offered once a preview exists, so nothing can be written by a
            single click on a file nobody has looked at. */}
        {state.status === "preview" && (
          <button
            type="submit"
            name="intent"
            value="save"
            disabled={pending}
            className="font-display inline-flex min-h-12 items-center rounded-[3px] bg-mark px-6 text-base font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep disabled:opacity-60"
          >
            Guardar {state.parse?.rows.length}
          </button>
        )}
      </div>

      <div aria-live="polite">
        {state.message && (
          <p
            className={`mt-5 rounded-[3px] px-4 py-3 text-sm ${
              state.status === "error"
                ? "bg-mark-soft text-mark-deep"
                : "bg-span-soft text-ink"
            }`}
          >
            {state.message}
            {state.status === "saved" && state.removed ? (
              <> Se reemplazaron {state.removed} registros anteriores de esos grupos.</>
            ) : null}
          </p>
        )}

        {state.status === "preview" && state.parse && (
          <div className="mt-5 rounded-[3px] border border-rule bg-card p-5">
            <p className="label text-graphite">Así se leyó</p>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Separador: {state.delimiter}</li>
              <li>Encabezado: {state.parse.headerSkipped ? "sí, omitido" : "no"}</li>
              <li>
                Grupos:{" "}
                {[...new Set(state.parse.rows.map((r) => `${r.englishLevel}-${r.group}`))]
                  .sort()
                  .join(", ")}
              </li>
            </ul>

            <p className="label mt-4 text-graphite">Primeras filas</p>
            <ul className="mt-2 space-y-1 font-mono text-sm text-graphite">
              {state.parse.rows.slice(0, 5).map((r) => (
                <li key={r.matricula}>
                  {r.matricula} · {r.fullName ?? "(sin nombre)"} · Inglés {r.englishLevel} ·{" "}
                  {r.group}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Rejected lines are shown for BOTH preview and save: a student dropped
            silently here becomes a false absence that a professor chases. */}
        {state.parse && state.parse.errors.length > 0 && (
          <div className="mt-5 rounded-[3px] border border-mark bg-mark-soft p-5">
            <p className="label text-mark-deep">
              {state.parse.errors.length}{" "}
              {state.parse.errors.length === 1 ? "fila no se pudo leer" : "filas no se pudieron leer"}
            </p>
            <ul className="mt-2 space-y-1 font-mono text-sm text-mark-deep">
              {state.parse.errors.slice(0, 10).map((e) => (
                <li key={e.line}>
                  línea {e.line}: {e.reason} — {e.text}
                </li>
              ))}
            </ul>
          </div>
        )}

        {state.parse && state.parse.duplicates.length > 0 && (
          <p className="mt-5 text-sm text-graphite">
            Matrículas repetidas (se quedó la última): {state.parse.duplicates.join(", ")}
          </p>
        )}
      </div>
    </form>
  );
}
