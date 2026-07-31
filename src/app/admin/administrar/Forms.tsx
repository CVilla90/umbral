"use client";

import { useActionState, useState } from "react";
import {
  addProfessor,
  removeAssignment,
  reopenAttempt,
  saveAssignment,
  saveWindow,
  toggleProfessor,
  type ManageState,
} from "./actions";

const INITIAL: ManageState = { status: "idle" };

/**
 * ⚠️ Every input on this page is CONTROLLED.
 *
 * An uncontrolled input whose `defaultValue` changes between renders is reset by
 * React, and a server action re-rendering its own form is exactly that
 * situation. It silently broke the roster's two-step flow on 2026-07-31 while
 * typecheck, lint and the parser tests all stayed green — the only thing that
 * found it was clicking both buttons. Do not "simplify" these back.
 */

function Feedback({ state }: { state: ManageState }) {
  if (!state.message) return null;
  return (
    <p
      aria-live="polite"
      className={`mt-3 rounded-[3px] px-3 py-2 text-sm ${
        state.status === "error" ? "bg-mark-soft text-mark-deep" : "bg-span-soft text-ink"
      }`}
    >
      {state.message}
    </p>
  );
}

const FIELD =
  "mt-1 w-full rounded-[3px] border border-rule bg-card px-3 py-2 text-base outline-none focus:border-ink";
const BUTTON =
  "font-display inline-flex min-h-11 items-center rounded-[3px] border border-ink px-5 text-sm font-bold transition-colors hover:bg-paper-lift disabled:opacity-60";
const PRIMARY =
  "font-display inline-flex min-h-11 items-center rounded-[3px] bg-mark px-5 text-sm font-bold text-on-mark transition-colors hover:bg-mark-deep disabled:opacity-60";

/* ------------------------------------------------------------------ */

export function WindowForm({
  windowId,
  phase,
  status,
  opensOn,
  closesOn,
}: {
  windowId: string;
  phase: string;
  status: string;
  /** Already formatted `YYYY-MM-DD` in Chihuahua time by the server, so the
   *  markup is identical on both sides and hydration cannot drift. */
  opensOn: string;
  closesOn: string;
}) {
  const [state, action, pending] = useActionState(saveWindow, INITIAL);
  const [form, setForm] = useState({ status, opensOn, closesOn });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form action={action} className="rounded-[3px] border border-rule bg-card p-5">
      <input type="hidden" name="windowId" value={windowId} />
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="font-display text-lg font-bold tracking-[-0.02em]">
          {phase === "entry" ? "Entrada" : "Salida"}
        </h3>
        <span className="label text-graphite">{status}</span>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="label text-graphite">Abre</span>
          <input
            type="date"
            name="opensOn"
            value={form.opensOn}
            onChange={set("opensOn")}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="label text-graphite">Cierra</span>
          <input
            type="date"
            name="closesOn"
            value={form.closesOn}
            onChange={set("closesOn")}
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="label text-graphite">Estado</span>
          <select
            name="status"
            value={form.status}
            onChange={set("status")}
            className={FIELD}
          >
            <option value="draft">borrador</option>
            <option value="open">abierta</option>
            <option value="paused">en pausa</option>
            <option value="closed">cerrada</option>
          </select>
        </label>
      </div>

      <button type="submit" disabled={pending} className={`${PRIMARY} mt-4`}>
        {pending ? "Guardando…" : "Guardar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function ProfessorForm() {
  const [state, action, pending] = useActionState(addProfessor, INITIAL);
  const [form, setForm] = useState({ name: "", email: "" });

  return (
    <form action={action} className="mt-4 rounded-[3px] border border-rule bg-card p-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="label text-graphite">Nombre</span>
          <input
            name="name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="Ramírez Gómez"
            className={FIELD}
          />
        </label>
        <label className="block">
          <span className="label text-graphite">Correo (opcional)</span>
          <input
            name="email"
            type="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="profesor@uach.mx"
            className={FIELD}
          />
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${BUTTON} mt-4`}>
        {pending ? "Agregando…" : "Agregar profesor"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function ToggleProfessor({
  professorId,
  isActive,
}: {
  professorId: string;
  isActive: boolean;
}) {
  const [state, action, pending] = useActionState(toggleProfessor, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="professorId" value={professorId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink disabled:opacity-60"
      >
        {isActive ? "Desactivar" : "Reactivar"}
      </button>
      {state.status === "error" && (
        <span className="ml-2 text-sm text-mark-deep">{state.message}</span>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */

export function AssignmentForm({
  semesterId,
  professors,
}: {
  semesterId: string;
  professors: { id: string; name: string }[];
}) {
  const [state, action, pending] = useActionState(saveAssignment, INITIAL);
  const [form, setForm] = useState({ englishLevel: "1", group: "", professorId: "" });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <form action={action} className="mt-4 rounded-[3px] border border-rule bg-card p-5">
      <input type="hidden" name="semesterId" value={semesterId} />
      <div className="grid gap-4 sm:grid-cols-3">
        <label className="block">
          <span className="label text-graphite">Nivel</span>
          <select
            name="englishLevel"
            value={form.englishLevel}
            onChange={set("englishLevel")}
            className={FIELD}
          >
            {[1, 2, 3, 4].map((l) => (
              <option key={l} value={l}>
                Inglés {l}
              </option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label text-graphite">Grupo</span>
          <input
            name="group"
            value={form.group}
            onChange={set("group")}
            placeholder="A"
            maxLength={4}
            className={`${FIELD} uppercase`}
          />
        </label>
        <label className="block">
          <span className="label text-graphite">Profesor</span>
          <select
            name="professorId"
            value={form.professorId}
            onChange={set("professorId")}
            className={FIELD}
          >
            <option value="">Escoge…</option>
            {professors.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <button type="submit" disabled={pending} className={`${BUTTON} mt-4`}>
        {pending ? "Guardando…" : "Asignar"}
      </button>
      <Feedback state={state} />
    </form>
  );
}

export function RemoveAssignment({ assignmentId }: { assignmentId: string }) {
  const [state, action, pending] = useActionState(removeAssignment, INITIAL);
  return (
    <form action={action}>
      <input type="hidden" name="assignmentId" value={assignmentId} />
      <button
        type="submit"
        disabled={pending}
        className="inline-flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink disabled:opacity-60"
      >
        Quitar
      </button>
      {state.status === "error" && (
        <span className="ml-2 text-sm text-mark-deep">{state.message}</span>
      )}
    </form>
  );
}

/* ------------------------------------------------------------------ */

/**
 * Reopening is the one action here that touches a finished measurement, so it
 * asks twice — the button arms a confirmation instead of firing.
 *
 * It does not delete anything (see `reopenAttempt`), but it does clear scores
 * that reports are read from, and "I clicked the wrong row" is a real Tuesday.
 */
export function ReopenAttempt({ attemptId, label }: { attemptId: string; label: string }) {
  const [state, action, pending] = useActionState(reopenAttempt, INITIAL);
  const [armed, setArmed] = useState(false);

  if (state.status === "ok") {
    return <p className="text-sm text-ink">{state.message}</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="attemptId" value={attemptId} />
      {armed ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm text-graphite">¿Reabrir {label}?</span>
          <button type="submit" disabled={pending} className={PRIMARY}>
            {pending ? "Reabriendo…" : "Sí, reabrir"}
          </button>
          <button
            type="button"
            onClick={() => setArmed(false)}
            className="inline-flex min-h-11 items-center text-sm text-graphite underline underline-offset-4 hover:text-ink"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setArmed(true)} className={BUTTON}>
          Reabrir
        </button>
      )}
      <Feedback state={state} />
    </form>
  );
}
