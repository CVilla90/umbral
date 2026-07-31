/**
 * Development helper: force a window open so the student path can be walked
 * before the real semester starts.
 *
 *   node --env-file-if-exists=.env tools/dev-open-window.mjs entry
 *
 * Undo with `npm run db:seed`, which restores the real dates from
 * `src/lib/calendar.ts`.
 *
 * ⚠️ Stop `npm run dev` first. PGlite serves ONE connection at a time, so the
 * Next dev server and any script here compete for it — the second one to connect
 * gets "Can't reach database server".
 *
 * This is a local convenience only. In production the admin edits window dates
 * through the dashboard; nothing here ships.
 */
import { PrismaClient } from "@prisma/client";

const phase = process.argv[2] ?? "entry";
if (!["entry", "exit"].includes(phase)) {
  console.error(`unknown phase "${phase}" — use entry or exit`);
  process.exit(1);
}

const db = new PrismaClient();
try {
  const semester = await db.semester.findFirst({ where: { isActive: true } });
  if (!semester) throw new Error("no active semester — run `npm run db:seed` first");

  const result = await db.window.updateMany({
    where: { semesterId: semester.id, phase },
    data: {
      opensAt: new Date(Date.now() - 86_400_000),
      closesAt: new Date(Date.now() + 30 * 86_400_000),
      status: "open",
    },
  });

  console.log(`\n  ${phase}: forced open (${result.count} window)`);
  console.log(`  Undo with: npm run db:seed\n`);
} finally {
  await db.$disconnect();
}
