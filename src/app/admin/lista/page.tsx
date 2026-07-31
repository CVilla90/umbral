import { activeSemester } from "@/lib/adminData";
import { db } from "@/lib/db";
import RosterForm from "./RosterForm";

export const dynamic = "force-dynamic";

/**
 * Class lists — the only thing that turns a participation COUNT into a
 * participation PERCENTAGE.
 *
 * Umbral only learns a student exists once they sign in, so without a roster the
 * denominator is unknown and `sin empezar` is unknowable. Coverage is expected to
 * stay partial forever (PLAN §9): Carlos can upload his own groups, other
 * professors' lists are not worth blocking on. This page therefore reports
 * coverage per group rather than as one number.
 */
export default async function AdminRoster() {
  const semester = await activeSemester();
  if (!semester) {
    return (
      <p className="mt-8 rounded-[3px] border border-rule bg-card p-6 text-graphite">
        No hay un semestre activo.
      </p>
    );
  }

  const existing = await db().rosterEntry.groupBy({
    by: ["englishLevel", "group"],
    where: { semesterId: semester.id },
    _count: { _all: true },
  });
  const covered = existing.sort(
    (a, b) => a.englishLevel - b.englishLevel || a.group.localeCompare(b.group),
  );

  const total = covered.reduce((n, g) => n + g._count._all, 0);

  return (
    <div>
      <p className="label text-graphite">{semester.label}</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em]">
        Listas de grupo
      </h1>
      <p className="mt-3 max-w-2xl text-[0.95rem] leading-relaxed text-graphite">
        Subir una lista es lo único que convierte un conteo en un porcentaje. Sin
        lista, Umbral solo puede decir cuántos participaron, nunca de cuántos —
        y no puede saber quién no entró. Los grupos sin lista siguen funcionando;
        simplemente aparecen como conteo.
      </p>

      <section className="mt-8">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
          Grupos con lista cargada
        </h2>
        {covered.length === 0 ? (
          <p className="mt-3 rounded-[3px] border border-rule bg-card p-5 text-graphite">
            Todavía ninguno. Toda la participación se está reportando como conteo.
          </p>
        ) : (
          <>
            <div className="mt-3 flex flex-wrap gap-2">
              {covered.map((g) => (
                <span
                  key={`${g.englishLevel}-${g.group}`}
                  className="label rounded-[3px] border border-rule bg-card px-3 py-2"
                >
                  Inglés {g.englishLevel}-{g.group}
                  <span className="ml-2 font-mono text-graphite">{g._count._all}</span>
                </span>
              ))}
            </div>
            <p className="mt-3 text-sm text-graphite">{total} alumnos en total.</p>
          </>
        )}
      </section>

      <section className="mt-10 border-t border-rule pt-8">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em]">Cargar una lista</h2>
        <p className="mt-2 text-sm text-graphite">
          Se reemplazan únicamente los grupos que aparezcan en lo que pegues. Los
          demás grupos no se tocan.
        </p>
        <RosterForm />
      </section>
    </div>
  );
}
