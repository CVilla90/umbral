import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { activeSemester, pairsFor } from "@/lib/adminData";
import { pairedCsv, pairedFilename } from "@/lib/progress";

/**
 * The paired entry→exit file — the one that leaves this app and goes into SPSS,
 * R or Jamovi.
 *
 * Wide format, one row per student: a paired t-test wants both measurements on
 * the same row, and reshaping in a stats package is exactly the step where
 * someone accidentally pairs the wrong two attempts. `/api/admin/asistencia`
 * remains the long, per-window file.
 *
 * ⚠️ Same gate as attendance, and for a stronger reason: this file carries every
 * student's matrícula, name, email and BOTH of their scores. It is the most
 * sensitive URL in the app.
 *
 * `?profesor=` narrows it, so a professor can be handed their own group's
 * progress without receiving the faculty's.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const semester = await activeSemester();
  if (!semester) return new NextResponse("No hay semestre activo", { status: 404 });

  const professor = request.nextUrl.searchParams.get("profesor")?.trim() || null;

  let students = await pairsFor(semester.id);
  if (professor) {
    students = students.filter((s) => (s.professorName ?? "sin asignar") === professor);
  }

  return new NextResponse(pairedCsv(students), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${pairedFilename(semester.label, professor)}"`,
      "cache-control": "no-store",
    },
  });
}
