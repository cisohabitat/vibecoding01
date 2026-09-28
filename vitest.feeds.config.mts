import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Live feed check (network): run by `npm run check:feeds` and the Feed health
// workflow, never by `npm test`
export default defineConfig({
  test: {
    include: ["scripts/feed-health.test.ts"],
    testTimeout: 120_000, // includes a pause before retrying failed feeds
    // The report is the point: print it even when the check passes
    silent: false,
  },
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
});
