import Link from "next/link";
import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { loadStudentState } from "@/lib/student";
import { daysBetween, gain, pct } from "@/lib/attempt";
import { CURRENT_SEMESTER, longDate } from "@/lib/calendar";

export const dynamic = "force-dynamic";

/**
 * What a student sees when they finish.
 *
 * One number, warmly framed, and an honest line about what it does and does not
 * mean. At exit it also shows the difference from their entry score — that reveal
 * is the single best reason a student comes back for the second window, so it is
 * a feature of the measurement design, not a nicety.
 *
 * No breakdown by skill, and no CEFR label. Eight anchor items is a cohort ruler,
 * not an individual placement (PLAN §2.5), and a per-skill score from three items
 * would be noise dressed as feedback.
 */
export default async function Resultado() {
  const session = await getSession();
  if (!session) redirect("/");

  const state = await loadStudentState(session.userId);
  if (!state.enrollment) redirect("/ficha");

  const attempts = await db().attempt.findMany({
    where: { enrollmentId: state.enrollment.id, state: { not: "in_progress" } },
    include: { window: true },
    orderBy: { submittedAt: "asc" },
  });
  if (!attempts.length) redirect("/inicio");

  const entry = attempts.find((a) => a.window.phase === "entry");
  const exit = attempts.find((a) => a.window.phase === "exit");
  const latest = attempts[attempts.length - 1];

  const latestPct = pct(latest.totalRaw, latest.maxTotal);
  const entryPct = entry ? pct(entry.totalRaw, entry.maxTotal) : null;
  const exitPct = exit ? pct(exit.totalRaw, exit.maxTotal) : null;
  const delta = gain(entryPct, exitPct);
  const between = daysBetween(entry?.submittedAt ?? null, exit?.submittedAt ?? null);
  const isEntry = latest.window.phase === "entry";

  return (
    <Shell email={session.email}>
      <p className="label text-graphite">
        Medición de {isEntry ? "entrada" : "salida"} &middot; {state.semester?.label}
      </p>

      <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
        {latest.completed ? "Listo. Gracias." : "Guardamos lo que respondiste."}
      </h1>

      <div className="mt-10 rounded-[3px] border border-rule bg-card p-8">
        <p className="label text-graphite">Tu resultado</p>
        <p className="font-display mt-2 text-7xl leading-none font-extrabold">
          {latestPct ?? 0}
          <span className="text-4xl text-graphite">%</span>
        </p>
        <p className="mt-4 text-[0.95rem] leading-relaxed text-graphite">
          {latest.totalRaw} de {latest.maxTotal} puntos.{" "}
          {!latest.completed && "Quedaron preguntas sin responder, y esas cuentan como cero. "}
          Esto no afecta tu calificación.
        </p>
      </div>

      {/* The gain reveal — only meaningful once both marks exist. */}
      {delta !== null && (
        <section className="mt-8 rounded-[3px] bg-span-soft p-8">
          <p className="label text-span">Tu avance en el semestre</p>
          <p className="font-display mt-2 text-6xl leading-none font-extrabold text-span">
            {delta > 0 ? "+" : ""}
            {delta}
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            {delta > 0
              ? `Subiste ${delta} puntos porcentuales entre tu medición de entrada y la de salida.`
              : delta === 0
                ? "Saliste igual que como entraste en esta medición."
                : `Esta vez saliste ${Math.abs(delta)} puntos por debajo de tu entrada. Pasa: un día malo, prisa, o preguntas que no te tocaron.`}
            {between !== null && ` Pasaron ${between} días entre una y otra.`}
          </p>
        </section>
      )}

      {isEntry && (
        <p className="mt-8 leading-relaxed text-graphite">
          Nos vemos en la medición de salida, a partir del{" "}
          {longDate(CURRENT_SEMESTER.exitOpensAt)}. Ahí vas a poder ver cuánto
          avanzaste.
        </p>
      )}

      <Link
        href="/inicio"
        className="font-display mt-10 inline-flex items-center gap-3 rounded-[3px] border border-ink px-7 py-3.5 text-base font-bold tracking-[-0.005em] transition-colors hover:bg-ink hover:text-paper"
      >
        Volver al inicio
      </Link>
    </Shell>
  );
}
