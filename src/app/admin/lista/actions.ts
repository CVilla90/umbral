"use server";

import { revalidatePath } from "next/cache";
import { isAdminRequest } from "@/lib/admin";
import { db } from "@/lib/db";
import { parseRoster, delimiterLabel, type RosterParse } from "@/lib/roster";

export interface RosterState {
  status: "idle" | "preview" | "saved" | "error";
  message?: string;
  parse?: RosterParse;
  delimiter?: string;
  saved?: number;
  removed?: number;
}

/**
 * Parse always, write only on an explicit second action.
 *
 * ⚠️ **Dry-run is the default and the Guardar button is a separate submit.**
 * A roster is the only thing in Umbral that can invent a student who does not
 * exist, and every invented student becomes a `sin empezar` absence that a
 * professor chases. Seeing the parse — delimiter, header, row count, rejected
 * lines — before anything is written is cheap; discovering a mis-parsed file
 * after professors have been emailed is not.
 */
export async function submitRoster(
  _prev: RosterState,
  formData: FormData,
): Promise<RosterState> {
  if (!(await isAdminRequest())) {
    return { status: "error", message: "No autorizado." };
  }

  const text = String(formData.get("texto") ?? "");
  const intent = String(formData.get("intent") ?? "preview");

  if (!text.trim()) {
    return { status: "error", message: "Pega la lista primero." };
  }

  const parse = parseRoster(text);
  if (parse.rows.length === 0) {
    return {
      status: "error",
      message: "No se pudo leer ninguna fila. Revisa el formato: matrícula, nombre, nivel, grupo.",
      parse,
    };
  }

  if (intent !== "save") {
    return {
      status: "preview",
      parse,
      delimiter: delimiterLabel(parse.delimiter),
      message: `${parse.rows.length} alumnos listos para guardar.`,
    };
  }

  const semester = await db().semester.findFirst({ where: { isActive: true } });
  if (!semester) return { status: "error", message: "No hay un semestre activo.", parse };

  // Replace only the groups this file covers. A blanket delete would wipe the
  // groups a previous upload established, and an upsert-only pass would leave a
  // student who has since dropped the course listed as `sin empezar` forever.
  const groups = [...new Set(parse.rows.map((r) => `${r.englishLevel}|${r.group}`))].map((k) => {
    const [level, group] = k.split("|");
    return { englishLevel: Number(level), group };
  });

  const removed = await db().rosterEntry.deleteMany({
    where: { semesterId: semester.id, OR: groups },
  });

  await db().rosterEntry.createMany({
    data: parse.rows.map((r) => ({
      semesterId: semester.id,
      englishLevel: r.englishLevel,
      group: r.group,
      matricula: r.matricula,
      fullName: r.fullName,
    })),
  });

  revalidatePath("/admin");
  revalidatePath("/admin/lista");

  return {
    status: "saved",
    parse,
    saved: parse.rows.length,
    removed: removed.count,
    message: `Guardados ${parse.rows.length} alumnos en ${groups.length} ${
      groups.length === 1 ? "grupo" : "grupos"
    }.`,
  };
}
