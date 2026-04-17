import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * In CI: builds and starts both API and Web servers.
 * Locally: reuses existing dev servers if running.
 *
 * Auth strategy: API runs without CLERK_SECRET_KEY (dev mock user).
 * Frontend auth is bypassed by injecting NovaUser into localStorage
 * via the test helper (see e2e/helpers.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? "github" : "html",
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"] },
    },
  ],
  webServer: [
    {
      command:
        "cd apps/api && NODE_ENV=development node dist/index.js",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        NODE_ENV: "development",
        PORT: "3001",
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        REDIS_URL: process.env.REDIS_URL ?? "",
      },
    },
    {
      command: "cd apps/web && node .output/server/index.mjs",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 30000,
      env: {
        PORT: "3000",
        NUXT_PUBLIC_API_BASE: "http://localhost:3001",
      },
    },
  ],
});
