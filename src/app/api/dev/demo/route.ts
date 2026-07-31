import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { devToolsEnabled, notFound } from "@/lib/dev";
import { gradeItem } from "@/lib/grading";
import { rng, itemSeed, optionOrder } from "@/lib/shuffle";
import { startOrResume, stepsForAttempt, submitAttempt } from "@/lib/student";
import type { Item } from "@/lib/types";

/**
 * Development-only: fabricate a cohort that has ALREADY taken both windows.
 *
 * WHY THIS EXISTS: half the admin dashboard — gain, the form-effect check, item
 * discrimination, the score distributions — cannot render anything until the
 * exit window runs in December. Without this, those pages would ship in August
 * having never once been seen with data in them, and the first time anyone
 * looked would be the day the numbers mattered.
 *
 *   /api/dev/demo?n=60     create (or top up to) 60 demo students, both windows
 *   /api/dev/demo?clean=1  delete every demo student and everything they wrote
 *
 * ⚠️ Gated by `devToolsEnabled()` — NODE_ENV plus the DEV_LOGIN flag — and 404s
 * otherwise, like every other dev route.
 *
 * ⚠️ **The fabricated attempts go through the REAL scoring path.** Responses are
 * written with `gradeItem`, and totals come from `submitAttempt`, the same
 * function a real submission calls. Inventing plausible-looking totals directly
 * would have made every dashboard verification meaningless: the pages would have
 * been checked against numbers this file made up rather than against the
 * instrument.
 *
 * ⚠️ Every row it creates is marked `demo:` in `User.googleId` and `DEMO` in the
 * name, so `?clean=1` can remove exactly these and nothing else.
 */

const MARK = "demo:";
const GROUPS = ["A", "B", "C"];
const NAMES = [
  "Ana", "Luis", "Sofía", "Diego", "Valeria", "Mateo", "Camila", "Emilio",
  "Regina", "Santiago", "Ximena", "Iker", "Renata", "Bruno", "Danna", "Leo",
];
const SURNAMES = [
  "Ramírez", "Soto", "Chávez", "Ontiveros", "Holguín", "Baeza", "Quezada",
  "Portillo", "Aguirre", "Terrazas",
];

export async function GET(request: NextRequest) {
  if (!devToolsEnabled()) return notFound();

  const params = request.nextUrl.searchParams;

  if (params.get("clean")) {
    const { count } = await db().user.deleteMany({
      where: { googleId: { startsWith: MARK } },
    });
    // Enrollments, attempts and responses all cascade from User.
    return NextResponse.json({ deleted: count });
  }

  const n = Math.min(200, Math.max(1, Number(params.get("n") ?? 40)));

  const semester = await db().semester.findFirst({
    where: { isActive: true },
    include: { windows: true },
  });
  if (!semester) return NextResponse.json({ error: "no active semester" }, { status: 400 });

  const entry = semester.windows.find((w) => w.phase === "entry");
  const exit = semester.windows.find((w) => w.phase === "exit");
  if (!entry || !exit) {
    return NextResponse.json({ error: "semester needs both windows" }, { status: 400 });
  }

  // One generator for the whole run, seeded by a constant: re-running produces
  // the same cohort, so a number that looks wrong on a dashboard can be chased
  // instead of vanishing on the next call.
  const random = rng(20260731);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(random() * xs.length)];

  const made: string[] = [];

  for (let i = 0; i < n; i++) {
    const matricula = `9${String(900000 + i)}`;
    const email = `demo${i}@uach.mx`;
    const fullName = `${pick(NAMES)} ${pick(SURNAMES)} DEMO`;
    const englishLevel = 1 + Math.floor(random() * 4);
    const group = pick(GROUPS);
    // 50/50, the same counterbalancing rule the real enrollment applies.
    const formOrder = random() < 0.5 ? "AB" : "BA";

    const user = await db().user.upsert({
      where: { googleId: `${MARK}${email}` },
      update: {},
      create: { googleId: `${MARK}${email}`, email, name: fullName, role: "student" },
    });

    const enrollment = await db().enrollment.upsert({
      where: { userId_semesterId: { userId: user.id, semesterId: semester.id } },
      update: {},
      create: {
        userId: user.id,
        semesterId: semester.id,
        matricula,
        fullName,
        age: 18 + Math.floor(random() * 5),
        gender: pick(["F", "M", "O", "N"]),
        academicSemester: 1 + Math.floor(random() * 8),
        group,
        englishLevel,
        formOrder,
        consentAt: new Date(),
      },
    });

    // Ability on a 0–1 scale, plus what this student gained over the semester.
    // Both are drawn once and reused across the two windows, which is what makes
    // the paired data behave like paired data rather than two unrelated draws.
    const ability = 0.25 + random() * 0.55;
    const growth = 0.02 + random() * 0.22;

    await walkWindow(enrollment.id, entry.id, ability, random);
    await walkWindow(enrollment.id, exit.id, Math.min(0.98, ability + growth), random);

    made.push(matricula);
  }

  return NextResponse.json({ created: made.length, matriculas: made.slice(0, 5) });
}

/**
 * Answers a whole attempt at a given ability and submits it.
 *
 * The response rows are shaped exactly like the player's — for mcq, `raw` holds
 * `{ authored, shown }`, because the item-analysis page reads `authored` from
 * there and would otherwise be verified against a shape that never occurs.
 */
async function walkWindow(
  enrollmentId: string,
  windowId: string,
  ability: number,
  random: () => number,
) {
  const attempt = await startOrResume(enrollmentId, windowId);
  if (!attempt || attempt.state !== "in_progress") return;

  const steps = stepsForAttempt(attempt.englishLevel, attempt.form, attempt.itemSnapshot);

  for (const step of steps) {
    const item = step.item;
    const right = random() < ability;
    const { raw, graded } = answerFor(item, right, attempt.optionSeed, random);

    await db().response.upsert({
      where: { attemptId_itemId: { attemptId: attempt.id, itemId: item.id } },
      update: {},
      create: {
        attemptId: attempt.id,
        itemId: item.id,
        block: step.block,
        type: item.type,
        raw: raw as never,
        // The real scoring path, not a guess at what it would have said.
        points: gradeItem(item, graded),
        correct: gradeItem(item, graded) === item.points,
        maxPoints: item.points,
        msElapsed: Math.round(8000 + random() * 40000),
        skipped: false,
      },
    });
  }

  await submitAttempt(attempt.id);
}

type Graded = Parameters<typeof gradeItem>[1];

function answerFor(
  item: Item,
  right: boolean,
  seed: number,
  random: () => number,
): { raw: unknown; graded: Graded } {
  switch (item.type) {
    case "mcq": {
      const authored = right
        ? item.correct
        : (item.correct + 1 + Math.floor(random() * (item.choices.length - 1))) %
          item.choices.length;
      const order = optionOrder(item.choices.length, itemSeed(seed, item.id));
      return {
        raw: { authored, shown: order.indexOf(authored) },
        graded: { kind: "mcq", value: authored },
      };
    }
    case "tf": {
      const value = right ? item.correct : !item.correct;
      return { raw: value, graded: { kind: "tf", value } };
    }
    case "match": {
      const value: Record<string, string> = {};
      for (const pair of item.pairs) {
        value[pair.left] = random() < (right ? 0.9 : 0.35) ? pair.right : "—";
      }
      return { raw: value, graded: { kind: "match", value } };
    }
    case "gap": {
      const value: Record<string, string> = {};
      for (const seg of item.segments) {
        if (seg.kind !== "blank") continue;
        value[String(seg.n)] = random() < (right ? 0.9 : 0.3) ? seg.answer : "xxx";
      }
      return { raw: value, graded: { kind: "gap", value } };
    }
    case "open": {
      const value = right ? (item.accepted[0] ?? "") : "xxx";
      return { raw: value, graded: { kind: "open", value } };
    }
    case "speaking": {
      // Never calls Gemini: this writes the transcript the route would have
      // produced. A demo cohort must not spend the speaking quota.
      const transcript = right ? (item.model ?? "I am from Chihuahua.") : "";
      return { raw: transcript, graded: { kind: "speaking", transcript } };
    }
  }
}
