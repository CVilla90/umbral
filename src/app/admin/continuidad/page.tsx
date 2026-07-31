import { returningStudents, semesterSeries } from "@/lib/adminData";
import { fmt1 } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Continuidad — the longest arc the instrument can draw.
 *
 * ⚠️ **This page is empty by construction until a second semester exists**, and
 * it says so rather than drawing a chart with one point on it. A single-point
 * trend line is not a trend, and the first thing anyone does with one is read a
 * slope off it.
 *
 * ⚠️ Only the **anchor** column may be compared across semesters. It is the same
 * eight items for every level and every cohort — a fixed ruler (PLAN §2.2). The
 * total is level-specific, so a semester with a different mix of Inglés 1 and
 * Inglés 4 students moves it for reasons that have nothing to do with learning.
 *
 * Deliberately a scaffold: the shape is here and correct, so August 2027 is a
 * page that fills itself rather than a feature someone has to remember to build.
 */
export default async function AdminContinuity() {
  const series = await semesterSeries();
  const returning = await returningStudents();
  const semesters = new Set(series.map((p) => p.semesterId));

  return (
    <div>
      <h1 className="font-display text-3xl font-bold tracking-[-0.02em]">Continuidad</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">
        Cómo se mueve la facultad de un semestre al siguiente, y qué pasa con los
        alumnos que vuelven a medirse en el siguiente nivel.
      </p>

      {semesters.size < 2 && (
        <div className="mt-8 max-w-2xl rounded-[3px] border border-rule bg-card p-6">
          <p className="text-graphite">
            Solo hay un semestre registrado, así que todavía no hay continuidad que
            mostrar. Esta pantalla empieza a servir hasta{" "}
            <strong className="text-ink">Ene-Jun 2027</strong>.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-graphite">
            Está vacía por construcción, no por una falla: con un solo punto no hay
            tendencia, y una gráfica de un punto invita justo a leerle una pendiente
            que no existe. La tabla de abajo ya funciona y se va a llenar sola.
          </p>
        </div>
      )}

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
          Por semestre
        </h2>
        {series.length === 0 ? (
          <p className="mt-3 text-sm text-graphite">Todavía no hay mediciones entregadas.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[3px] border border-rule">
            <table className="w-full min-w-[30rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-lift text-left">
                  <Th>Semestre</Th>
                  <Th>Fase</Th>
                  <Th right>n</Th>
                  <Th right>Ancla %</Th>
                  <Th right>Total %</Th>
                </tr>
              </thead>
              <tbody>
                {series.map((p) => (
                  <tr
                    key={`${p.semesterId}-${p.phase}`}
                    className="border-b border-rule-soft last:border-0"
                  >
                    <Td>{p.label}</Td>
                    <Td>{p.phase === "entry" ? "entrada" : "salida"}</Td>
                    <Td right>{p.n}</Td>
                    <Td right>
                      <strong>{fmt1(p.anchorMean)}</strong>
                    </Td>
                    <Td right>
                      <span className="text-graphite">{fmt1(p.totalMean)}</span>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">
          ⚠️ Solo la columna <strong>Ancla</strong> se puede comparar entre
          semestres: son los mismos ocho reactivos para todos los niveles y todas
          las generaciones, o sea una regla fija. El <strong>Total</strong> depende
          del nivel, así que un semestre con más alumnos de Inglés 4 mueve ese
          número sin que nadie haya aprendido nada — está en gris por eso.
        </p>
      </section>

      <section className="mt-10">
        <h2 className="font-display text-xl font-bold tracking-[-0.02em]">
          Alumnos que regresan
        </h2>
        {returning.length === 0 ? (
          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">
            Ninguno todavía. Un alumno aparece aquí cuando se mide en dos semestres
            distintos — por ejemplo Inglés 1 en agosto e Inglés 2 en enero —, y
            entonces tiene cuatro mediciones sobre la misma escala del ancla.
          </p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-[3px] border border-rule">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-lift text-left">
                  <Th>Alumno</Th>
                  <Th>Matrícula</Th>
                  <Th>Semestres</Th>
                </tr>
              </thead>
              <tbody>
                {returning.map((s) => (
                  <tr key={s.matricula} className="border-b border-rule-soft last:border-0">
                    <Td>{s.fullName}</Td>
                    <Td>
                      <span className="font-mono">{s.matricula}</span>
                    </Td>
                    <Td>{s.semesters.join(" · ")}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Th({ children, right }: { children?: React.ReactNode; right?: boolean }) {
  return (
    <th className={`label px-4 py-3 font-normal text-graphite ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-4 py-3 ${right ? "text-right font-mono" : ""}`}>{children}</td>;
}
