import { db } from "@/lib/db";
import { activeSemester } from "@/lib/adminData";
import { normalizeMatricula } from "@/lib/exports";
import { formatDate, zonedDate } from "@/lib/zone";
import {
  AssignmentForm,
  ProfessorForm,
  RemoveAssignment,
  ReopenAttempt,
  ToggleProfessor,
  WindowForm,
} from "./Forms";

export const dynamic = "force-dynamic";

/**
 * Administrar — the page that makes next semester typing instead of a deploy.
 *
 * Everything here edits rows that already exist: window dates and status,
 * professors, the group→professor mapping, and reopening an attempt. That is
 * the whole design constraint. Any question that could have needed a code change
 * in January was turned into a row instead.
 *
 * ⚠️ Dates are calendar days in Chihuahua time (`lib/zone.ts`), never the
 * server's local time — Replit runs in UTC and would move every window by six
 * hours, which at a day boundary is a whole day.
 */
export default async function AdminManage({
  searchParams,
}: {
  searchParams: Promise<{ alumno?: string }>;
}) {
  const semester = await activeSemester();
  if (!semester) return <Empty>No hay un semestre activo. Corre `npm run db:seed`.</Empty>;

  const { alumno } = await searchParams;
  const query = alumno?.trim() ?? "";

  const [professors, assignments] = await Promise.all([
    db().professor.findMany({ orderBy: [{ isActive: "desc" }, { name: "asc" }] }),
    db().groupAssignment.findMany({
      where: { semesterId: semester.id },
      include: { professor: { select: { name: true } } },
      orderBy: [{ englishLevel: "asc" }, { group: "asc" }],
    }),
  ]);

  // Matrículas are typed by hand on both sides, so the search folds spacing and
  // case the same way the roster merge does.
  const found = query
    ? await db().enrollment.findMany({
        where: { semesterId: semester.id },
        include: {
          attempts: { include: { window: { select: { phase: true } } } },
        },
      })
    : [];
  const matches = found.filter(
    (e) => normalizeMatricula(e.matricula) === normalizeMatricula(query),
  );

  return (
    <div>
      <p className="label text-graphite">{semester.label}</p>
      <h1 className="font-display mt-1 text-3xl font-bold tracking-[-0.02em]">Administrar</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-graphite">
        Todo lo de esta pantalla son datos, no código: el semestre que viene se
        cambia escribiendo aquí.
      </p>

      <Section title="Ventanas">
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite">
          El estado y las fechas son independientes a propósito: poner una ventana
          en pausa no debe borrar el calendario que está pausando. Para que una
          ventana admita alumnos tienen que coincidir las dos cosas — estado{" "}
          <span className="font-mono">abierta</span> y la fecha de hoy dentro del
          rango. Las fechas son días completos, hora de Chihuahua; el día de cierre
          cuenta entero.
        </p>
        <div className="mt-4 grid gap-4">
          {semester.windows.map((w) => (
            <WindowForm
              key={w.id}
              windowId={w.id}
              phase={w.phase}
              status={w.status}
              opensOn={zonedDate(w.opensAt)}
              closesOn={zonedDate(w.closesAt)}
            />
          ))}
        </div>
      </Section>

      <Section title="Profesores">
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite">
          Son una tabla y no un campo de texto justamente porque el texto libre
          produce seis maneras de escribir a la misma persona, y luego seis
          renglones en cada reporte. No se borran: se desactivan, para que los
          resultados de semestres pasados sigan siendo legibles.
        </p>
        <ProfessorForm />

        {professors.length > 0 && (
          <div className="mt-4 overflow-x-auto rounded-[3px] border border-rule">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-lift text-left">
                  <Th>Nombre</Th>
                  <Th>Correo</Th>
                  <Th>Estado</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {professors.map((p) => (
                  <tr key={p.id} className="border-b border-rule-soft last:border-0">
                    <Td>{p.name}</Td>
                    <Td>{p.email ?? "—"}</Td>
                    <Td>{p.isActive ? "activo" : "inactivo"}</Td>
                    <Td>
                      <ToggleProfessor professorId={p.id} isActive={p.isActive} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Grupos">
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite">
          Nivel y grupo → profesor. Esta tabla manda: al guardar una asignación se
          reasignan también los alumnos que ya se habían registrado en ese grupo,
          porque los alumnos entran antes de que la tabla esté completa y si no
          quedarían como <span className="font-mono">sin asignar</span> el resto
          del semestre.
        </p>
        <AssignmentForm
          semesterId={semester.id}
          professors={professors.filter((p) => p.isActive).map((p) => ({ id: p.id, name: p.name }))}
        />

        {assignments.length === 0 ? (
          <p className="mt-4 text-sm text-graphite">
            Todavía no hay grupos asignados, así que todos los reportes dirán{" "}
            <span className="font-mono">sin asignar</span>.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-[3px] border border-rule">
            <table className="w-full min-w-[28rem] border-collapse text-sm">
              <thead>
                <tr className="border-b border-rule bg-paper-lift text-left">
                  <Th>Grupo</Th>
                  <Th>Profesor</Th>
                  <Th></Th>
                </tr>
              </thead>
              <tbody>
                {assignments.map((a) => (
                  <tr key={a.id} className="border-b border-rule-soft last:border-0">
                    <Td>
                      Inglés {a.englishLevel}-{a.group}
                    </Td>
                    <Td>{a.professor.name}</Td>
                    <Td>
                      <RemoveAssignment assignmentId={a.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section title="Reabrir un intento">
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-graphite">
          Para cuando alguien entregó sin querer, o se le cayó la conexión y quedó
          incompleto. Reabrir <strong>conserva todas sus respuestas</strong> y solo
          borra los puntajes calculados; el alumno regresa a la primera pantalla
          que no contestó y al entregar se vuelve a calificar.
        </p>

        {/* A plain GET form: searching is read-only and belongs in the URL, and
            keeping it out of the action state means the reopen button below is a
            first click, not a second one on a stale result. */}
        <form method="get" className="mt-4 flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="label text-graphite">Matrícula</span>
            <input
              name="alumno"
              defaultValue={query}
              placeholder="349021"
              className="mt-1 w-48 rounded-[3px] border border-rule bg-card px-3 py-2 text-base outline-none focus:border-ink"
            />
          </label>
          <button
            type="submit"
            className="font-display inline-flex min-h-11 items-center rounded-[3px] border border-ink px-5 text-sm font-bold transition-colors hover:bg-paper-lift"
          >
            Buscar
          </button>
        </form>

        {query && matches.length === 0 && (
          <p className="mt-4 text-sm text-graphite">
            No hay ningún alumno con la matrícula{" "}
            <span className="font-mono">{query}</span> en este semestre.
          </p>
        )}

        {matches.map((e) => (
          <div key={e.id} className="mt-4 rounded-[3px] border border-rule bg-card p-5">
            <p className="font-display text-lg font-bold tracking-[-0.02em]">{e.fullName}</p>
            <p className="label mt-1 text-graphite">
              {e.matricula} · Inglés {e.englishLevel}-{e.group} · orden {e.formOrder}
            </p>

            {e.attempts.length === 0 ? (
              <p className="mt-3 text-sm text-graphite">No ha empezado ningún intento.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {e.attempts.map((a) => (
                  <li
                    key={a.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-t border-rule-soft pt-3"
                  >
                    <span className="text-sm">
                      {a.window.phase === "entry" ? "Entrada" : "Salida"} · forma {a.form} ·{" "}
                      <span className="font-mono">{a.state}</span>
                      {a.totalRaw !== null && (
                        <>
                          {" "}
                          · {a.totalRaw}/{a.maxTotal}
                        </>
                      )}
                      {a.submittedAt && <> · {formatDate(a.submittedAt)}</>}
                    </span>
                    {a.state === "in_progress" ? (
                      <span className="text-sm text-graphite">ya está abierto</span>
                    ) : (
                      <ReopenAttempt
                        attemptId={a.id}
                        label={`la ${a.window.phase === "entry" ? "entrada" : "salida"} de ${e.fullName}`}
                      />
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-12 border-t border-rule pt-8">
      <h2 className="font-display text-xl font-bold tracking-[-0.02em]">{title}</h2>
      {children}
    </section>
  );
}

function Th({ children }: { children?: React.ReactNode }) {
  return <th className="label px-4 py-3 font-normal text-graphite">{children}</th>;
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-4 py-3">{children}</td>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-8 max-w-2xl rounded-[3px] border border-rule bg-card p-6 text-graphite">
      {children}
    </p>
  );
}
