import { defineConfig, devices } from "@playwright/test";

// E2E smoke tests for the v2 build. Runs against a production build served by the
// standalone server (client/dist + API on one origin). Start the server first, or let
// Playwright start it via `webServer` (needs DATABASE_URL + JWT_SECRET in the environment).
const PORT = process.env.PORT ?? "3000";
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    viewport: { width: 390, height: 844 }, // mobile-first (build spec §6.4)
  },
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: "node server/dist/src/index.js",
    url: `http://localhost:${PORT}/api/health`,
    timeout: 60_000,
    reuseExistingServer: true,
    env: {
      NODE_ENV: "production",
      PORT,
      DATABASE_URL: process.env.DATABASE_URL ?? "",
      JWT_SECRET: process.env.JWT_SECRET ?? "test-jwt-secret-at-least-32-characters-long-xyz",
      DISABLE_RATE_LIMIT: "1", // E2E logs in repeatedly; never set this in production
    },
  },
});
