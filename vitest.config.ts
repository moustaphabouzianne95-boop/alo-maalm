import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as loadEnv } from "dotenv";
import { defineConfig } from "vitest/config";

const root = path.dirname(fileURLToPath(import.meta.url));

// Load `.env` before any test module imports `src/lib/env.ts`, which validates
// the process environment at load time.
loadEnv({ path: path.join(root, ".env") });

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 45_000,
    hookTimeout: 45_000,
  },
  resolve: {
    alias: {
      "@": path.join(root, "src"),
    },
  },
});
