import { NextResponse, type NextRequest } from "next/server";
import { isAdminRequest } from "@/lib/admin";
import { activeSemester, attendanceFor } from "@/lib/adminData";
import { attendanceCsv, attendanceFilename } from "@/lib/exports";

/**
 * The attendance list a professor can be handed directly.
 *
 * `?profesor=` narrows it to one professor, which is the operational case:
 * Carlos sends each professor only their own students, not a faculty-wide file
 * containing every student's matrícula and score.
 *
 * ⚠️ Gated by `isAdminRequest()`, which re-derives admin status from
 * ADMIN_EMAILS rather than trusting the session cookie. This endpoint returns
 * every student's name, matrícula, email and score in the faculty; it is the most
 * sensitive URL in the app.
 *
 * ⚠️ The CSV carries a **UTF-8 BOM** and RFC-4180 quoting (both in
 * `exports.ts`). Without the BOM, Spanish Excel renders "Ramírez" as mojibake;
 * without the quoting, a name containing a comma shifts every later column.
 */
export async function GET(request: NextRequest) {
  if (!(await isAdminRequest())) {
    return new NextResponse("No autorizado", { status: 403 });
  }

  const semester = await activeSemester();
  if (!semester) return new NextResponse("No hay semestre activo", { status: 404 });

  const phase = request.nextUrl.searchParams.get("fase") === "exit" ? "exit" : "entry";
  const window = semester.windows.find((w) => w.phase === phase);
  if (!window) return new NextResponse("No hay ventana de esa fase", { status: 404 });

  const professor = request.nextUrl.searchParams.get("profesor")?.trim() || null;

  let students = await attendanceFor(semester.id, window.id);
  if (professor) {
    students = students.filter((s) => s.professorName === professor);
  }

  const csv = attendanceCsv(students);
  const filename = attendanceFilename(phase, semester.label, professor);

  return new NextResponse(csv, {
    headers: {
      // charset=utf-8 alongside the BOM: the header covers anything reading the
      // response as text, the BOM covers Excel, which ignores the header.
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${filename}"`,
      // Attendance changes minute to minute during a live window.
      "cache-control": "no-store",
    },
  });
}
