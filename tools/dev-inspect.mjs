/**
 * Development helper: dump what a walkthrough actually wrote.
 *
 *   node --env-file-if-exists=.env tools/dev-inspect.mjs
 *
 * ⚠️ Stop `npm run dev` first — PGlite serves one connection at a time.
 *
 * Exists because "the pages rendered" is not the same claim as "the measurement
 * was recorded correctly". This prints the row-level facts the dashboard and the
 * thesis will later depend on: which form was served, the frozen snapshot, the
 * per-item scores, and the anchor/level split.
 */
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
try {
  const attempts = await db.attempt.findMany({
    include: {
      enrollment: { include: { user: true } },
      window: true,
      responses: { orderBy: { itemId: "asc" } },
    },
    orderBy: { startedAt: "asc" },
  });

  if (!attempts.length) console.log("\n  no attempts yet\n");

  for (const a of attempts) {
    const e = a.enrollment;
    console.log(`\n  ${e.user.email}  ·  Inglés ${e.englishLevel}  ·  grupo ${e.group}`);
    console.log(`  formOrder=${e.formOrder}  window=${a.window.phase}  ->  form served = ${a.form}`);
    console.log(`  state=${a.state}  completed=${a.completed}  seed=${a.optionSeed}`);
    console.log(
      `  anchor ${a.anchorRaw}/${a.maxAnchor}   level ${a.levelRaw}/${a.maxLevel}   total ${a.totalRaw}/${a.maxTotal}`,
    );
    console.log(`  snapshot: ${(a.itemSnapshot ?? []).length} items frozen`);

    const byBlock = {};
    for (const r of a.responses) {
      byBlock[r.block] ??= { pts: 0, max: 0, n: 0, skipped: 0 };
      byBlock[r.block].pts += r.points;
      byBlock[r.block].max += r.maxPoints;
      byBlock[r.block].n += 1;
      if (r.skipped) byBlock[r.block].skipped += 1;
    }
    for (const [block, s] of Object.entries(byBlock)) {
      console.log(
        `    ${block.padEnd(10)} ${String(s.pts).padStart(2)}/${String(s.max).padEnd(2)}  items=${s.n}  skipped=${s.skipped}`,
      );
    }

    const timed = a.responses.filter((r) => r.msElapsed != null);
    if (timed.length) {
      const total = timed.reduce((s, r) => s + r.msElapsed, 0);
      console.log(`    latency: ${Math.round(total / 1000)}s across ${timed.length} items`);
    }
  }
  console.log("");
} finally {
  await db.$disconnect();
}
