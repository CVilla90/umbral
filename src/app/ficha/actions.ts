"use server";

import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth/session";
import { randomFormOrder } from "@/lib/attempt";

/**
 * Saves the ficha and enrolls the student for the active semester.
 *
 * This is where `formOrder` is drawn — once per student per semester, 50/50, and
 * never again. Everything about the counterbalanced design (PLAN §2.1) rests on
 * this single random draw, which is why it lives here and not in the attempt
 * creation path where it would be re-rolled on every window.
 */

export interface FichaError {
  fields: Record<string, string>;
  message?: string;
}

const GROUPS = ["A", "B", "C", "D", "E", "F", "G"];

function str(data: FormData, key: string): string {
  const v = data.get(key);
  return typeof v === "string" ? v.trim() : "";
}

export async function saveFicha(
  _prev: FichaError | null,
  data: FormData,
): Promise<FichaError | null> {
  const session = await getSession();
  if (!session) redirect("/");

  const semester = await db().semester.findFirst({ where: { isActive: true } });
  if (!semester) return { fields: {}, message: "No hay un semestre activo ahora mismo." };

  const fields: Record<string, string> = {};

  const fullName = str(data, "fullName");
  if (fullName.length < 3) fields.fullName = "Escribe tu nombre completo.";

  const matricula = str(data, "matricula").toUpperCase();
  // Lenient on purpose: a rejected matrícula stops a measurement, and a
  // mistyped one only needs to be fixable later. Length is the only real check.
  if (matricula.length < 4) fields.matricula = "Escribe tu matrícula.";

  const academicSemester = Number(str(data, "academicSemester"));
  if (!Number.isInteger(academicSemester) || academicSemester < 1 || academicSemester > 8) {
    fields.academicSemester = "Elige un semestre del 1 al 8.";
  }

  const group = str(data, "group").toUpperCase();
  if (!GROUPS.includes(group)) fields.group = "Elige tu grupo.";

  const englishLevel = Number(str(data, "englishLevel"));
  if (!Number.isInteger(englishLevel) || englishLevel < 1 || englishLevel > 4) {
    fields.englishLevel = "Elige el inglés que estás cursando.";
  }

  const ageRaw = str(data, "age");
  let age: number | null = null;
  if (ageRaw) {
    const n = Number(ageRaw);
    if (!Number.isInteger(n) || n < 15 || n > 80) fields.age = "Escribe una edad válida.";
    else age = n;
  }

  const gender = str(data, "gender") || null;
  const professorRaw = str(data, "professorRaw") || null;

  if (!data.get("consent")) {
    fields.consent = "Necesitamos tu consentimiento para guardar tus respuestas.";
  }

  if (Object.keys(fields).length) return { fields };

  // The professor that COUNTS comes from the admin's group mapping, never from
  // what the student typed (PLAN §6.2). The typed value is kept verbatim as a
  // cross-check on whether they picked the right group.
  const mapping = await db().groupAssignment.findUnique({
    where: {
      semesterId_englishLevel_group: { semesterId: semester.id, englishLevel, group },
    },
  });

  await db().enrollment.upsert({
    where: { userId_semesterId: { userId: session.userId, semesterId: semester.id } },
    update: {
      fullName,
      matricula,
      age,
      gender,
      academicSemester,
      group,
      englishLevel,
      professorRaw,
      professorId: mapping?.professorId ?? null,
    },
    create: {
      userId: session.userId,
      semesterId: semester.id,
      fullName,
      matricula,
      age,
      gender,
      academicSemester,
      group,
      englishLevel,
      professorRaw,
      professorId: mapping?.professorId ?? null,
      formOrder: randomFormOrder(),
      consentAt: new Date(),
    },
  });

  redirect("/prueba");
}
