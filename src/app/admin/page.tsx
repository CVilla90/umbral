import Link from "next/link";
import { activeSemester, attendanceFor } from "@/lib/adminData";
import { attendanceRows, attendanceSummary, type ProfessorSummary } from "@/lib/exports";

export const dynamic = "force-dynamic";

/**
 * Participation — the page Carlos actually watches during a live window.
 *
 * Four states, not two (PLAN §9): `completa` and `incompleta` both count as
 * participation and need nothing; `empezada` is the nudge list; `sin empezar` is
 * the chase list. Collapsing to "participated / did not" would throw away the
 * distinction a professor most needs.
 */
export default async function AdminOverview({
  searchParams,
}: {
  searchParams: Promise<{ fase?: string }>;
}) {
  const semester = await activeSemester();
  if (!semester) return <Empty>No hay un semestre activo. Corre `npm run db:seed`.</Empty>;

  const { fase } = await searchParams;
  const phase = fase === "exit" ? "exit" : "entry";
  const window = semester.windows.find((w) => w.phase === phase);
  if (!window) return <Empty>El semestre no tiene ventana de {label(phase)}.</Empty>;

  const students = await attendanceFor(semester.id, window.id);
  const rows = attendanceRows(students);
  const summary = attendanceSummary(rows);

  const totals = rows.reduce(
    (acc, r) => ({ ...acc, [r.participacion]: (acc[r.participacion] ?? 0) + 1 }),
    {} as Record<string, number>,
  );
  const participaron = (totals.completa ?? 0) + (totals.incompleta ?? 0);

  return (
    <div>
      <div className="flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <p className="label text-graphite">{semester.label}</p>
          <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em]">
            Participación
          </h1>
        </div>
        <div className="flex gap-2">
          <PhaseTab active={phase === "entry"} href="/admin?fase=entry">
            Entrada
          </PhaseTab>
          <PhaseTab active={phase === "exit"} href="/admin?fase=exit">
            Salida
          </PhaseTab>
        </div>
      </div>

      <p className="mt-3 text-sm text-graphite">
        Ventana de {label(phase)} &middot; {fmt(window.opensAt)} — {fmt(window.closesAt)}{" "}
        &middot; <span className="font-mono">{window.status}</span>
      </p>

      {rows.length === 0 ? (
        <Empty>
          Todavía nadie se ha registrado en esta ventana. Cuando alguien llene su
          ficha aparecerá aquí.
        </Empty>
      ) : (
        <>
          <div className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-[3px] bg-rule sm:grid-cols-4">
            <Stat n={totals.completa ?? 0} label="Completa" />
            <Stat n={totals.incompleta ?? 0} label="Incompleta" />
            <Stat n={totals.empezada ?? 0} label="Empezada" hint="hay que recordarles" />
            <Stat
              n={totals["sin empezar"] ?? 0}
              label="Sin empezar"
              hint="solo con lista cargada"
            />
          </div>

          <p className="mt-4 text-sm text-graphite">
            <strong className="text-ink">{participaron}</strong> de {rows.length} registros
            participaron.
          </p>

          <h2 className="font-display mt-10 text-xl font-bold tracking-[-0.02em]">
            Por profesor
          </h2>
          <ProfessorTable summary={summary} />

          <div className="mt-8 flex flex-wrap items-center gap-4 border-t border-rule pt-6">
            <a
              href={`/api/admin/asistencia?fase=${phase}`}
              className="font-display inline-flex min-h-12 items-center rounded-[3px] bg-mark px-6 py-3 text-base font-bold tracking-[-0.005em] text-on-mark transition-colors hover:bg-mark-deep"
            >
              Descargar CSV
            </a>
            <span className="text-sm text-graphite">
              Se abre en Excel con acentos correctos.
            </span>
          </div>
        </>
      )}
    </div>
  );
}

function ProfessorTable({ summary }: { summary: ProfessorSummary[] }) {
  return (
    // The table is the one thing here that can outgrow a phone, so it scrolls
    // inside its own box rather than making the page scroll sideways.
    <div className="mt-4 overflow-x-auto rounded-[3px] border border-rule">
      <table className="w-full min-w-[34rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-rule bg-paper-lift text-left">
            <Th>Profesor</Th>
            <Th right>Completa</Th>
            <Th right>Incompleta</Th>
            <Th right>Empezada</Th>
            <Th right>Sin empezar</Th>
            <Th right>Participación</Th>
          </tr>
        </thead>
        <tbody>
          {summary.map((s) => (
            <tr key={s.profesor} className="border-b border-rule-soft last:border-0">
              <Td>{s.profesor}</Td>
              <Td right>{s.completa}</Td>
              <Td right>{s.incompleta}</Td>
              <Td right>{s.empezada}</Td>
              <Td right>{s["sin empezar"]}</Td>
              <Td right>
                {/* ⚠️ Never a percentage without a roster. Umbral only sees a
                    student once they sign in, so dividing by "who showed up"
                    would print 100 % for every unrostered group beside a
                    rostered group's 58 % — fiction that reads as fact. */}
                {s.pct === null ? (
                  <span className="text-graphite">
                    {s.participaron}{" "}
                    <span className="whitespace-nowrap">(lista no cargada)</span>
                  </span>
                ) : (
                  <span className="font-mono">{s.pct}%</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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

function PhaseTab({
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

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th className={`label px-4 py-3 font-normal text-graphite ${right ? "text-right" : ""}`}>
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-4 py-3 ${right ? "text-right" : ""}`}>{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 rounded-[3px] border border-rule bg-card p-6 text-graphite">
      {children}
    </p>
  );
}

const label = (phase: string) => (phase === "entry" ? "entrada" : "salida");

const FMT = new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short", year: "numeric" });
const fmt = (d: Date) => FMT.format(d);
