import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Mirrors the `@/*` -> `src/*` alias from tsconfig.json so tests import the same
// way the app does. Pure-function tests run in the default node environment.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
