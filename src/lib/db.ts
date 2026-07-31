import { PrismaClient } from "@prisma/client";

/**
 * Lazy Prisma singleton. Lazy because the landing page, the "wrong domain" page
 * and the health check must all render on a machine with no DATABASE_URL — a
 * misconfigured deploy should show a page that explains itself, not a stack
 * trace.
 *
 * In dev the client is cached on globalThis so hot reload doesn't open a new pool
 * on every edit.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export function dbConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function db(): PrismaClient {
  if (!dbConfigured()) {
    throw new Error("DATABASE_URL is not set — run `npm run db:dev` or set it in .env");
  }
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient();
  }
  return globalForPrisma.prisma;
}
