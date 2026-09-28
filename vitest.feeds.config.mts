import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live feed check (network): run by `npm run check:feeds` and the Feed health
// workflow, never by `npm test`
export default defineConfig({
  test: {
    include: ["scripts/feed-health.test.ts"],
    testTimeout: 60_000,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
