import { activeSemester, pairsFor } from "@/lib/adminData";
import {
  formEffect,
  gainBy,
  gainDirection,
  pairCoverage,
  pairedRows,
  pairedOnly,
  type GainGroup,
} from "@/lib/progress";
import { fmt1 } from "@/lib/stats";

export const dynamic = "force-dynamic";

/**
 * Avance — entry vs exit, the number the whole instrument exists to produce.
 *
 * ⚠️ **This page is empty until the exit window runs in December, by design.**
 * It says so rather than rendering zeroes, because an empty dashboard that looks
 * broken gets "fixed" by someone filling it with placeholder numbers.
 *
 * Three things are on it, in order of how much they should be trusted:
 *
 *  1. **Coverage.** How many students have both measurements. A mean gain over
 *     40 % of the cohort is a different claim from one over 90 %, and the second
 *     number is the one that decides whether the first is worth quoting.
 *  2. **Gain**, per level and per group. Never fabricated: a student missing
 *     either window contributes nothing, not a zero.
 *  3. **The form-effect check** — the instrument auditing itself. See below.
 */
export default async function AdminProgress() {
  const semester = await activeSemester();
  if (!semester) return <Empty>No hay un semestre activo.</Empty>;

  const rows = pairedRows(await pairsFor(semester.id));
  const paired = pairedOnly(rows);
  const coverage = pairCoverage(rows);
  const direction = gainDirection(rows);
  const fx = formEffect(rows);

  return (
    <div>
      <p className="label text-graphite">{semester.label}</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em]">Avance</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">
        Diferencia entre la medición de entrada y la de salida, en puntos
        porcentuales. Solo aparecen los alumnos que tienen <strong>las dos</strong>{" "}
        mediciones: con una sola, el avance no se sabe, y no es cero.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] bg-rule sm:grid-cols-4">
        <Stat n={coverage.completo} label="Con las dos" hint="se puede medir avance" />
        <Stat n={coverage.soloEntrada} label="Solo entrada" />
        <Stat n={coverage.soloSalida} label="Solo salida" hint="sin línea base" />
        <Stat n={coverage.ninguno} label="Ninguna" />
      </div>

      {paired.length === 0 ? (
        <>
          <Empty>
            Todavía no hay ningún alumno con las dos mediciones, así que no hay
            avance que mostrar. Esta pantalla se llena sola cuando corra la ventana
            de salida en diciembre.
          </Empty>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-graphite">
            Que esté vacía ahora es lo correcto, no una falla: en agosto solo
            existe la mitad del dato. Mientras tanto, <strong>Participación</strong>{" "}
            y <strong>Puntajes</strong> sí tienen contenido.
          </p>
        </>
      ) : (
        <>
          <p className="mt-6 text-sm text-graphite">
            <strong className="text-ink">{paired.length}</strong> de {coverage.total}{" "}
            alumnos tienen las dos mediciones ({pctOf(paired.length, coverage.total)}).
          </p>

          <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-[3px] bg-rule">
            <Stat n={direction.subieron} label="Subieron" />
            <Stat n={direction.iguales} label="Iguales" />
            <Stat n={direction.bajaron} label="Bajaron" />
          </div>
          <Note>
            El promedio por sí solo esconde la forma del grupo: +4 puntos puede ser
            todo el mundo avanzando un poco o un tercio del grupo retrocediendo.
          </Note>

          <Section title="Por nivel">
            <Table groups={gainBy(rows, (r) => r.nivel)} />
            <Note>
              ⚠️ El avance sí se puede comparar entre niveles aunque el puntaje
              crudo no: cada alumno es su propia línea base, así que la diferencia
              está medida contra sí mismo y no contra un papel más difícil.
            </Note>
          </Section>

          <Section title="Por grupo">
            <Table groups={gainBy(rows, (r) => `${r.nivel} · ${r.grupo}`)} />
          </Section>

          <Section title="Por profesor">
            <Table groups={gainBy(rows, (r) => r.profesor)} />
            <Note>
              Estas filas describen grupos, no desempeño docente: los grupos no se
              formaron al azar y sus tamaños son chicos.
            </Note>
          </Section>

          <Section title="Contrabalanceo (AB vs BA)">
            <Table groups={[fx.ab, fx.ba]} />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Check
                label="Diferencia de avance"
                value={fx.gainDifference}
                good="Las dos formas se comportan igual."
                bad="Una forma parece más fácil que la otra."
              />
              <Check
                label="Diferencia en la entrada"
                value={fx.entryDifference}
                good="El sorteo AB/BA quedó parejo."
                bad="El sorteo quedó disparejo: revisa esto antes que el avance."
              />
            </div>
            <Note>
              Esta es la verificación más importante que el instrumento puede
              hacerse a sí mismo. La mitad de los alumnos contesta A y luego B, la
              otra mitad B y luego A. Si las dos formas son de veras equivalentes,
              los dos grupos deben avanzar lo mismo, y cualquier diferencia real es
              dificultad de la forma filtrándose al puntaje.
              <br />
              <br />
              Léelas en este orden: <strong>primero la entrada</strong>. Ahí los dos
              grupos solo han sido sorteados, no enseñados, así que una diferencia
              grande es un sorteo disparejo y no un problema de las formas.
              Interpretar el avance sin revisar eso primero es como se publica una
              casualidad como hallazgo.
              <br />
              <br />
              Son números para mirar junto a su <span className="font-mono">n</span> y
              su <span className="font-mono">DE</span>, no un semáforo: con grupos de
              este tamaño, unos pocos puntos de diferencia son ruido.
            </Note>
          </Section>
        </>
      )}

      <div className="mt-10 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
        <a
          href="/api/admin/avance"
          className="font-display inline-flex min-h-12 items-center rounded-[3px] bg-mark px-6 py-3 text-base font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep"
        >
          Descargar CSV pareado
        </a>
        <span className="max-w-md text-sm text-graphite">
          Un renglón por alumno con las dos mediciones en la misma fila — el formato
          que piden SPSS, R y Jamovi para una prueba t pareada, sin reacomodar nada.
        </span>
      </div>
    </div>
  );
}

function Table({ groups }: { groups: GainGroup[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-[3px] border border-rule">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper-lift text-left">
            <Th></Th>
            <Th right>n</Th>
            <Th right>Entrada %</Th>
            <Th right>Salida %</Th>
            <Th right>Avance</Th>
            <Th right>DE</Th>
            <Th right>Mín</Th>
            <Th right>Máx</Th>
          </tr>
        </thead>
        <tbody>
          {groups.map((g) => (
            <tr key={g.key} className="border-b border-rule-soft last:border-0">
              <Td>{g.key}</Td>
              <Td right>{g.avance.n}</Td>
              <Td right>{fmt1(g.entrada.mean)}</Td>
              <Td right>{fmt1(g.salida.mean)}</Td>
              <Td right>
                <strong>{signed(g.avance.mean)}</strong>
              </Td>
              <Td right>{fmt1(g.avance.sd)}</Td>
              <Td right>{signed(g.avance.min)}</Td>
              <Td right>{signed(g.avance.max)}</Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * A difference with its reading attached. No threshold and no colour-coding:
 * it prints the number and what a big one would mean, and leaves the judgement
 * to the person who knows how many students are behind it.
 */
function Check({
  label,
  value,
  good,
  bad,
}: {
  label: string;
  value: number | null;
  good: string;
  bad: string;
}) {
  return (
    <div className="rounded-[3px] border border-rule bg-card p-4">
      <p className="label text-graphite">{label}</p>
      <p className="font-display mt-1 text-2xl font-bold tracking-[-0.02em]">
        {value === null ? "—" : signed(value)}
      </p>
      <p className="mt-1 text-sm text-graphite">
        {value === null
          ? "Falta gente en alguno de los dos grupos."
          : Math.abs(value) < 3
            ? good
            : bad}
      </p>
    </div>
  );
}

/** "+4.2" / "−1.5" / "—". The sign is the information; a bare 4.2 hides it. */
function signed(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  const s = fmt1(Math.abs(value));
  if (value > 0) return `+${s}`;
  if (value < 0) return `−${s}`;
  return "0.0";
}

function pctOf(part: number, whole: number): string {
  return whole === 0 ? "—" : `${Math.round((part / whole) * 1000) / 10}%`;
}

function Stat({ n, label, hint }: { n: number; label: string; hint?: string }) {
  return (
    <div className="bg-card p-5">
      <p className="font-display text-3xl font-bold tracking-[-0.02em]">{n}</p>
      <p className="label mt-1 text-graphite">{label}</p>
      {hint && <p className="mt-1 text-sm text-graphite">{hint}</p>}
    </div>
  );
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
  return <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">{children}</p>;
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 max-w-2xl rounded-[3px] border border-rule bg-card p-6 text-graphite">
      {children}
    </p>
  );
}
