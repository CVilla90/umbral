import { redirect } from "next/navigation";
import Shell from "@/components/Shell";
import FichaForm from "@/components/FichaForm";
import { getSession } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { loadStudentState } from "@/lib/student";

export const dynamic = "force-dynamic";

const LONG_DATE = new Intl.DateTimeFormat("es-MX", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export default async function Ficha() {
  const session = await getSession();
  if (!session) redirect("/");

  const state = await loadStudentState(session.userId);
  if (!state.semester) redirect("/inicio");

  const professors = await db().professor.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const e = state.enrollment;

  return (
    <Shell email={session.email}>
      <p className="label text-graphite">Antes de empezar</p>
      <h1 className="font-display mt-4 text-4xl leading-tight font-extrabold sm:text-5xl">
        Cuéntanos quién eres
      </h1>
      <p className="mt-4 max-w-lg leading-relaxed text-graphite">
        Son unos datos rápidos y no cuentan para nada. Los necesitamos para saber
        qué preguntas mostrarte y para poder comparar cómo avanza cada grupo.
      </p>

      <div className="mt-10">
        <FichaForm
          email={session.email}
          today={LONG_DATE.format(new Date())}
          suggestedName={session.name ?? ""}
          professors={professors}
          initial={
            e
              ? {
                  fullName: e.fullName,
                  matricula: e.matricula,
                  age: e.age,
                  gender: e.gender,
                  academicSemester: e.academicSemester,
                  group: e.group,
                  englishLevel: e.englishLevel,
                  professorRaw: e.professorRaw,
                }
              : null
          }
        />
      </div>
    </Shell>
  );
}
