import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["lib/**/*.test.ts"],
    // `npm run test:coverage` (CI) fails below these; UI components are
    // covered by the Playwright e2e tests instead
    coverage: {
      provider: "v8",
      include: ["lib/**/*.ts", "app/api/**/*.ts"],
      exclude: ["lib/__tests__/**", "lib/types.ts"],
      reporter: ["text-summary", "text"],
      thresholds: { lines: 85, statements: 85, functions: 85, branches: 80 },
    },
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
