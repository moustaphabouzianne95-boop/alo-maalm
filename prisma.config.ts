import path from "node:path";
import { defineConfig, env } from "prisma/config";
import "dotenv/config";

/**
 * Prisma 7-style config (the `package.json#prisma` block is deprecated).
 * `dotenv/config` loads `.env` before Prisma resolves the datasource URL, so
 * `prisma migrate`, `prisma generate` and `npm run db:seed` all work from a
 * plain shell.
 */
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
