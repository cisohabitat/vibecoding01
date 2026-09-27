import { defineConfig, devices } from "@playwright/test";

const FEED_PORT = 8765;
const APP_PORT = 3100;

export default defineConfig({
  testDir: "e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: `http://localhost:${APP_PORT}`,
    trace: "retain-on-failure",
    // Optional: use a pre-installed Chromium when the bundled one isn't
    // available (e.g. sandboxes whose browsers match another Playwright)
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
      : {},
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "node e2e/feed-server.mjs",
      url: `http://localhost:${FEED_PORT}/rss.xml`,
      env: { FEED_PORT: String(FEED_PORT) },
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `node e2e/wait-for.mjs http://localhost:${FEED_PORT}/rss.xml && npm run build && npx next start -p ${APP_PORT}`,
      url: `http://localhost:${APP_PORT}`,
      timeout: 240_000,
      env: {
        FEED_SOURCES_OVERRIDE: JSON.stringify([
          { name: "Fixture Feed", url: `http://localhost:${FEED_PORT}/rss.xml`, tier: 2 },
          // Two failing sources trigger the failed-feeds banner
          { name: "Broken Feed A", url: `http://localhost:${FEED_PORT}/broken-a`, tier: 3 },
          { name: "Broken Feed B", url: `http://localhost:${FEED_PORT}/broken-b`, tier: 3 },
        ]),
        NVD_API_URL: `http://localhost:${FEED_PORT}/nvd`,
        NO_PROXY: "localhost,127.0.0.1",
      },
      // Always build fresh: reusing a server left running from an older build
      // silently tests stale code
      reuseExistingServer: false,
    },
  ],
});
