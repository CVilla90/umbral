import Link from "next/link";
import { activeSemester, scoresFor, type ScoredAttempt } from "@/lib/adminData";
import { describe, fmt1, groupBy, histogram } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Score distributions.
 *
 * Three numbers per row, and only one of them is comparable across levels:
 *  - **Ancla** is the 8-item cross-level block. It is the only column where an
 *    Inglés 1 row and an Inglés 4 row are measured against the same ruler.
 *  - **Nivel** is that level's own items. Comparing it across levels is
 *    meaningless — a harder paper is supposed to produce a lower number.
 *  - **Total** is the reported score, and inherits the same restriction.
 *
 * The page says this out loud rather than trusting the reader to remember it,
 * because a table of numbers in one grid invites exactly the comparison that
 * PLAN §2.2 forbids.
 */
export default async function AdminScores({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string }>;
}) {
  const semester = await activeSemester();
  if (!semester) return <Empty>No hay un semestre activo.</Empty>;

  const { fase } = await searchParams;
  const phase = fase === "exit" ? "exit" : "entry";
  const window = semester.windows.find((w) => w.phase === phase);
  if (!window) return <Empty>El semestre no tiene ventana de esa fase.</Empty>;

  const scored = await scoresFor(semester.id, window.id);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label text-graphite">{semester.label}</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em]">
            Puntajes
          </h1>
        </div>
        <div className="flex gap-2">
          <Tab active={phase === "entry"} href="/admin/puntajes?fase=entry">
            Entrada
          </Tab>
          <Tab active={phase === "exit"} href="/admin/puntajes?fase=exit">
            Salida
          </Tab>
        </div>
      </div>

      {scored.length === 0 ? (
        <Empty>
          Nadie ha terminado su medición en esta ventana todavía. Solo se cuentan
          los intentos entregados.
        </Empty>
      ) : (
        <>
          <p className="mt-4 text-sm text-graphite">
            {scored.length} {scored.length === 1 ? "intento entregado" : "intentos entregados"}.
            Los intentos en curso no se cuentan.
          </p>

          <Section title="Todos">
            <Table rows={[["Todos", scored]]} />
          </Section>

          <Section title="Por nivel">
            <Table rows={sorted(groupBy(scored, (s) => `Inglés ${s.englishLevel}`))} />
            <Note>
              ⚠️ Solo la columna <strong>Ancla</strong> es comparable entre niveles.
              Es el bloque de 8 reactivos que todos contestan igual; las otras dos
              miden papeles distintos, así que un número más bajo en Inglés 4 no
              significa peor desempeño.
            </Note>
          </Section>

          <Section title="Por grupo">
            <Table rows={sorted(groupBy(scored, (s) => `${s.englishLevel}-${s.group}`))} />
          </Section>

          <Section title="Por profesor">
            <Table rows={sorted(groupBy(scored, (s) => s.professorName))} />
          </Section>

          <Section title="Por forma">
            <Table rows={sorted(groupBy(scored, (s) => `Forma ${s.form}`))} />
            <Note>
              Las formas A y B están contrabalanceadas, así que estas dos filas
              deberían parecerse. Una diferencia grande y sostenida es señal de que
              una forma es más difícil, y eso se corrige al comparar la cohorte, no
              al estudiante.
            </Note>
          </Section>

          <Section title="Distribución del total">
            <Histogram values={scored.map((s) => s.totalPct).filter(isNum)} />
          </Section>
        </>
      )}
    </div>
  );
}

function Table({ rows }: { rows: [string, ScoredAttempt[]][] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-[3px] border border-rule">
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper-lift text-left">
            <Th></Th>
            <Th right>n</Th>
            <Th right>Ancla %</Th>
            <Th right>Nivel %</Th>
            <Th right>Total %</Th>
            <Th right>DE</Th>
            <Th right>Mediana</Th>
            <Th right>Minutos</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([name, items]) => {
            const total = describe(items.map((i) => i.totalPct).filter(isNum));
            return (
              <tr key={name} className="border-b border-rule-soft last:border-0">
                <Td>{name}</Td>
                <Td right>{items.length}</Td>
                <Td right>{mean(items.map((i) => i.anchorPct))}</Td>
                <Td right>{mean(items.map((i) => i.levelPct))}</Td>
                <Td right>{fmt1(total.mean)}</Td>
                <Td right>{fmt1(total.sd)}</Td>
                <Td right>{fmt1(total.median)}</Td>
                <Td right>{mean(items.map((i) => i.durationMin))}</Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Ten bars, 0–100. Plain divs: a chart library for this would be all cost. */
function Histogram({ values }: { values: number[] }) {
  const bins = histogram(values, 10);
  const peak = Math.max(...bins, 1);
  return (
    <div className="mt-3 rounded-[3px] border border-rule bg-card p-5">
      <div className="flex h-40 items-end gap-1">
        {bins.map((count, i) => (
          <div key={i} className="flex flex-1 flex-col items-center justify-end gap-1">
            <span className="font-mono text-xs text-graphite">{count || ""}</span>
            <div
              className="w-full rounded-t-[2px] bg-span"
              style={{ height: `${(count / peak) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-1">
        {bins.map((_, i) => (
          <span key={i} className="label flex-1 text-center text-graphite">
            {i * 10}
          </span>
        ))}
      </div>
    </div>
  );
}

const isNum = (v: number | null): v is number => v !== null;

/** Mean of the non-null values, or an em dash. */
function mean(values: (number | null)[]): string {
  return fmt1(describe(values.filter(isNum)).mean);
}

/** Alphabetical, so the same group is in the same place between page loads. */
function sorted(map: Map<string, ScoredAttempt[]>): [string, ScoredAttempt[]][] {
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b, "es"));
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-sm leading-relaxed text-graphite">{children}</p>;
}

function Tab({
  active,
  href,
  children,
}: {
  active: boolean;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={`label inline-flex min-h-11 items-center rounded-[3px] border px-4 ${
        active
          ? "border-mark bg-mark-soft text-mark-deep"
          : "border-rule text-graphite hover:text-ink"
      }`}
    >
      {children}
    </Link>
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
  return (
    <td className={`px-4 py-3 ${right ? "text-right font-mono" : ""}`}>{children}</td>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 rounded-[3px] border border-rule bg-card p-6 text-graphite">
      {children}
    </p>
  );
}


