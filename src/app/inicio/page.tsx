import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getSession } from "@/lib/auth/session";
import { loadStudentState } from "@/lib/student";
import { pct } from "@/lib/attempt";
import { CURRENT_SEMESTER, longDate } from "@/lib/calendar";
import { MINUTES } from "@/lib/site";

export const dynamic = "force-dynamic";

/**
 * The student's one decision point. Its whole job is to route: fill the ficha,
 * start the check-in, or explain why there is nothing to do right now. Anything
 * else on this page is a way to not start.
 */
export default async function Inicio() {
  const session = await getSession();
  if (!session) redirect("/");

  const state = await loadStudentState(session.userId);
  const phaseWord = state.window?.phase === "exit" ? "salida" : "entrada";
  const doneThisWindow = state.done.some((d) => d.phase === state.window?.phase);

  return (
    <Shell email={session.email}>
      <p className="label text-graphite">{state.semester?.label ?? "Sin semestre activo"}</p>

      {/* A window is open and there is nothing standing in the way. */}
      {state.window && !doneThisWindow && (
        <>
          <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
            Tu medición de {phaseWord} está abierta
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-graphite">
            {MINUTES} minutos, sin reloj y sin calificación. Si tienes que
            interrumpir, tus respuestas se guardan solas y puedes seguir después.
          </p>
          <Link
            href={state.enrollment ? "/prueba" : "/ficha"}
            className="font-display mt-9 inline-flex items-center gap-3 rounded-[3px] bg-mark px-8 py-4 text-lg font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep"
          >
            {state.enrollment ? "Empezar" : "Empezar"}
            <span aria-hidden>&rarr;</span>
          </Link>
        </>
      )}

      {/* Already done for this window. Show the score plainly and say what's next. */}
      {state.window && doneThisWindow && (
        <>
          <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
            Ya la hiciste. Gracias.
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-graphite">
            {phaseWord === "entrada"
              ? `Nos vemos en la medición de salida, a partir del ${longDate(CURRENT_SEMESTER.exitOpensAt)}.`
              : "Con esto cerramos tu semestre. Que te vaya muy bien."}
          </p>
          <Scores state={state} />
        </>
      )}

      {/* Nothing open. Say which of the two reasons it is. */}
      {!state.window && (
        <>
          <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
            {state.closedReason === "too-early"
              ? "Todavía no abre"
              : state.closedReason === "too-late"
                ? "Esta medición ya cerró"
                : "No hay nada abierto ahora"}
          </h1>
          <p className="mt-4 max-w-lg leading-relaxed text-graphite">
            {state.closedReason === "too-early" &&
              `La medición de entrada abre el ${longDate(CURRENT_SEMESTER.entryOpensAt)}. Vuelve ese día.`}
            {state.closedReason === "too-late" &&
              "Se cerró la ventana de este semestre. Si crees que es un error, escribe a la Coordinación de Inglés."}
            {(state.closedReason === "paused" || state.closedReason === "no-window") &&
              "La Coordinación de Inglés todavía no abre una medición. Vuelve más adelante."}
          </p>
          <Scores state={state} />
        </>
      )}
    </Shell>
  );
}

/**
 * Past results, if any. Percentages are computed here from raw counts rather than
 * read from a stored column, so a scoring fix reflows what a student sees.
 */
function Scores({ state }: { state: Awaited<ReturnType<typeof loadStudentState>> }) {
  if (!state.done.length) return null;

  const entry = state.done.find((d) => d.phase === "entry");
  const exit = state.done.find((d) => d.phase === "exit");
  const entryPct = entry ? pct(entry.totalRaw, entry.maxTotal) : null;
  const exitPct = exit ? pct(exit.totalRaw, exit.maxTotal) : null;
  const delta = entryPct !== null && exitPct !== null ? Math.round((exitPct - entryPct) * 10) / 10 : null;

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <p className="label text-graphite">Tus mediciones</p>
      <div className="mt-5 flex flex-wrap gap-x-14 gap-y-6">
        <Mark label="Entrada" value={entryPct} />
        <Mark label="Salida" value={exitPct} />
        {delta !== null && (
          <div>
            <p className="label text-span">Diferencia</p>
            <p className="font-display mt-1 text-4xl font-extrabold text-span">
              {delta > 0 ? "+" : ""}
              {delta}
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function Mark({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <p className="label text-graphite">{label}</p>
      <p className="font-display mt-1 text-4xl font-extrabold">
        {value === null ? <span className="text-rule">—</span> : `${value}%`}
      </p>
    </div>
  );
}
