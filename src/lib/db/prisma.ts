import { PrismaClient } from "@prisma/client";
import { env } from "@/lib/env";

/**
 * Prisma client singleton.
 *
 * Next.js hot-reloads modules in development, which would otherwise open a new
 * connection pool on every edit and exhaust PostgreSQL's `max_connections`.
 * We stash the instance on `globalThis` so the pool survives reloads.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

/**
 * Serverless hosts open one pool per instance. Cap it on Vercel so a traffic
 * spike cannot exhaust Postgres `max_connections`. A pooled Neon/Vercel URL
 * already includes this and is left untouched.
 */
function databaseUrl(): string {
  const url = env.DATABASE_URL;
  if (!process.env.VERCEL || /[?&]connection_limit=/.test(url)) return url;
  return `${url}${url.includes("?") ? "&" : "?"}connection_limit=1`;
}

function createClient(): PrismaClient {
  return new PrismaClient({
    datasources: {
      db: {
        url: databaseUrl(),
      },
    },
    log:
      env.APP_ENV === "development"
        ? [{ emit: "stdout", level: "warn" }, { emit: "stdout", level: "error" }]
        : [{ emit: "stdout", level: "error" }],
  });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (env.APP_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Read-replica accessor. Returns the primary client when no replica is
 * configured, so call sites never need to branch.
 */
export const readDb = (() => {
  if (!env.DATABASE_READ_URL || env.DATABASE_READ_URL === env.DATABASE_URL) {
    return prisma;
  }
  const g = globalThis as unknown as { prismaRead: PrismaClient | undefined };
  if (!g.prismaRead) {
    g.prismaRead = new PrismaClient({
      datasources: { db: { url: env.DATABASE_READ_URL } },
      log: [{ emit: "stdout", level: "error" }],
    });
  }
  return g.prismaRead;
})();

export { Prisma } from "@prisma/client";
export type { PrismaClient } from "@prisma/client";
