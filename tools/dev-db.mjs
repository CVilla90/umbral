/**
 * A local Postgres for development — no Docker, no install, no cloud account.
 *
 * Umbral's whole student path is database-backed (session -> enrollment ->
 * attempt -> response), so without this there is nothing to test locally except
 * the landing page. PGlite is Postgres compiled to WASM, served here behind a
 * real Postgres wire-protocol socket, so Prisma talks to it exactly as it would
 * to a real server.
 *
 *   npm run db:dev      # terminal 1 — leave running
 *   npm run db:push     # terminal 2 — once, to create the tables
 *   npm run db:seed     # terminal 2 — the semester, its windows, the professors
 *   npm run dev         # terminal 2
 *
 * Data persists in `.pgdata/` (gitignored), so a signed-in account and a
 * half-finished attempt survive a restart — which is exactly the state you want
 * to be able to reproduce when testing resume-after-drop. Delete the folder for a
 * clean slate. Dev-only; the deploy uses Replit's Postgres.
 */
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";

const PORT = Number(process.env.DEV_DB_PORT ?? 5433);
const DATA_DIR = process.env.DEV_DB_DIR ?? ".pgdata";

const db = await PGlite.create({ dataDir: DATA_DIR });
const server = new PGLiteSocketServer({ db, port: PORT, host: "127.0.0.1" });
await server.start();

console.log(`\n  Postgres (PGlite) listo en 127.0.0.1:${PORT}  ·  datos: ${DATA_DIR}/`);
console.log(`  DATABASE_URL="postgresql://postgres:postgres@127.0.0.1:${PORT}/postgres"\n`);
console.log("  Déjalo corriendo. Sigue: `npm run db:push`, luego `npm run dev`.\n");

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  });
}
