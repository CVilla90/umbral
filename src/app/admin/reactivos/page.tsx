import Link from "next/link";
import { activeSemester, responsesFor } from "@/lib/adminData";
import {
  analyseItems,
  flagsFor,
  MIN_N_TO_FLAG,
  type ItemAnalysis,
  type ItemFlag,
} from "@/lib/items";
import { fmt1 } from "@/lib/stats";

export const dynamic = "force-dynamic";

const LEVELS = [1, 2, 3, 4];

/**
 * Item analysis — the quality-control loop the printed exams never had.
 *
 * The inherited banks carry a measured defect (option `c` correct zero times in
 * levels 1–3) that survived for years because nobody ever tabulated the answers.
 * This page is what makes that class of thing visible: after the entry window
 * closes, every question can be checked against how it actually behaved.
 *
 * ⚠️ Nothing here is automatic. A flag is a reading queue, not a verdict — an
 * easy opening question is deliberate, and a hard closing one is doing its job.
 * A human opens the item and decides.
 */
export default async function AdminItems({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string; nivel?: string }>;
}) {
  const semester = await activeSemester();
  if (!semester) return <Empty>No hay un semestre activo.</Empty>;

  const { fase, nivel } = await searchParams;
  const phase = fase === "exit" ? "exit" : "entry";
  const window = semester.windows.find((w) => w.phase === phase);
  if (!window) return <Empty>El semestre no tiene ventana de esa fase.</Empty>;

  const level = LEVELS.includes(Number(nivel)) ? Number(nivel) : undefined;
  const analyses = analyseItems(await responsesFor(semester.id, window.id, level));
  const flagged = analyses.filter((a) => flagsFor(a).length > 0);

  const q = (over: { fase?: string; nivel?: string }) => {
    const params = new URLSearchParams();
    params.set("fase", over.fase ?? phase);
    const n = over.nivel ?? (level ? String(level) : "");
    if (n) params.set("nivel", n);
    return `/admin/reactivos?${params}`;
  };

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label text-graphite">{semester.label}</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em]">Reactivos</h1>
        </div>
        <div className="flex gap-2">
          <Tab active={phase === "entry"} href={q({ fase: "entry" })}>
            Entrada
          </Tab>
          <Tab active={phase === "exit"} href={q({ fase: "exit" })}>
            Salida
          </Tab>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Tab active={!level} href={q({ nivel: "" })}>
          Todos
        </Tab>
        {LEVELS.map((l) => (
          <Tab key={l} active={level === l} href={q({ nivel: String(l) })}>
            Inglés {l}
          </Tab>
        ))}
      </div>

      {analyses.length === 0 ? (
        <Empty>
          Todavía no hay respuestas entregadas en esta ventana. Esta pantalla se
          llena sola conforme los alumnos terminan.
        </Empty>
      ) : (
        <>
          <p className="mt-6 text-sm text-graphite">
            {analyses.length} reactivos con al menos una respuesta.{" "}
            {flagged.length > 0 ? (
              <>
                <strong className="text-ink">{flagged.length}</strong> para revisar.
              </>
            ) : (
              <>Ninguno levantó bandera.</>
            )}
          </p>

          <Legend />

          {flagged.length > 0 && (
            <Section title="Para revisar primero">
              <Table analyses={flagged} />
            </Section>
          )}

          <Section title="Todos los reactivos">
            <Table analyses={analyses} />
          </Section>
        </>
      )}
    </div>
  );
}

function Table({ analyses }: { analyses: ItemAnalysis[] }) {
  return (
    <div className="mt-3 overflow-x-auto rounded-[3px] border border-rule">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper-lift text-left">
            <Th>Reactivo</Th>
            <Th>Bloque</Th>
            <Th right>n</Th>
            <Th right>Dificultad</Th>
            <Th right>Discrim.</Th>
            <Th right>Seg.</Th>
            <Th right>Omitidos</Th>
            <Th>Opciones</Th>
          </tr>
        </thead>
        <tbody>
          {analyses.map((a) => {
            const flags = flagsFor(a);
            return (
              <tr key={a.itemId} className="border-b border-rule-soft align-top last:border-0">
                <Td>
                  <span className="font-mono text-xs text-graphite">{a.itemId}</span>
                  <span className="mt-0.5 block max-w-xs">{a.label}</span>
                  {flags.length > 0 && (
                    <span className="mt-1 flex flex-wrap gap-1">
                      {flags.map((f) => (
                        <Flag key={f} flag={f} />
                      ))}
                    </span>
                  )}
                </Td>
                <Td>
                  <span className="whitespace-nowrap">{a.block}</span>
                  {a.levels.length === 4 && (
                    <span className="label mt-0.5 block text-graphite">todos los niveles</span>
                  )}
                </Td>
                <Td right>{a.n}</Td>
                <Td right>{a.pValue === null ? "—" : a.pValue.toFixed(2)}</Td>
                <Td right>
                  {a.discrimination === null ? "—" : a.discrimination.toFixed(2)}
                </Td>
                <Td right>{fmt1(a.medianSeconds)}</Td>
                <Td right>{a.skipped || ""}</Td>
                <Td>
                  {a.options ? <Options options={a.options} n={a.n} /> : null}
                </Td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Every option with how many students chose it. The correct one is marked, and
 * a distractor nobody picked is called out — an option doing no work makes the
 * item quietly easier than the blueprint claims.
 */
function Options({ options, n }: { options: ItemAnalysis["options"] & object; n: number }) {
  return (
    <ul className="min-w-[9rem] space-y-1">
      {options.map((o) => (
        <li key={o.authoredIndex} className="flex items-baseline gap-2 text-xs">
          <span
            className={`inline-block w-6 shrink-0 text-right font-mono ${
              o.picks === 0 && !o.isCorrect ? "text-mark-deep" : "text-graphite"
            }`}
          >
            {o.picks}
          </span>
          <span className="h-1.5 w-10 shrink-0 self-center rounded-[1px] bg-rule">
            <span
              className={`block h-full rounded-[1px] ${o.isCorrect ? "bg-span" : "bg-graphite"}`}
              style={{ width: `${n ? (o.picks / n) * 100 : 0}%` }}
            />
          </span>
          <span className={o.isCorrect ? "font-bold" : "text-graphite"}>{o.text}</span>
        </li>
      ))}
    </ul>
  );
}

function Flag({ flag }: { flag: ItemFlag }) {
  // "revisar clave" is the one that usually means a real mistake, so it is the
  // only one that gets the loud colour. The rest are worth a look, not an alarm.
  const loud = flag === "revisar clave";
  return (
    <span
      className={`label inline-block rounded-[2px] px-2 py-0.5 ${
        loud ? "bg-mark-soft text-mark-deep" : "bg-paper-lift text-graphite"
      }`}
    >
      {flag}
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-6 rounded-[3px] border border-rule bg-card p-5 text-sm leading-relaxed text-graphite">
      <p>
        <strong className="text-ink">Dificultad</strong> es la proporción de puntos
        que el grupo se llevó: <span className="font-mono">1.00</span> es que todos
        acertaron. Alto significa <em>fácil</em>, y un reactivo que casi todos
        contestan bien no separa a nadie.
      </p>
      <p className="mt-2">
        <strong className="text-ink">Discriminación</strong> es qué tanto ese
        reactivo ordena a los alumnos igual que el examen completo, quitando sus
        propios puntos del total. Arriba de <span className="font-mono">0.20</span>{" "}
        está sano; cerca de cero no separa;{" "}
        <strong className="text-ink">en negativo los alumnos más fuertes lo están
        fallando</strong>, que casi siempre es clave mal capturada u opción ambigua.
        Es el número más útil de esta pantalla.
      </p>
      <p className="mt-2">
        Nada se marca con menos de <span className="font-mono">{MIN_N_TO_FLAG}</span>{" "}
        respuestas: con pocos alumnos salen números alarmantes que no significan nada.
        Las banderas son una lista de lectura, no un veredicto — ningún reactivo se
        retira solo.
      </p>
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
  return <td className={`px-4 py-3 ${right ? "text-right font-mono" : ""}`}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 max-w-2xl rounded-[3px] border border-rule bg-card p-6 text-graphite">
      {children}
    </p>
  );
}
