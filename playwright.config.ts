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
      command: "node apps/api/dist/index.js",
      url: "http://localhost:3001/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        NODE_ENV: "development",
        PORT: "3001",
        DATABASE_URL: process.env.DATABASE_URL ?? "",
        REDIS_URL: process.env.REDIS_URL ?? "",
      },
    },
    {
      command: "node apps/web/.output/server/index.mjs",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: !process.env.CI,
      timeout: 60000,
      env: {
        PORT: "3000",
        NUXT_PUBLIC_API_BASE: "http://localhost:3001",
        NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          "pk_test_Y2xlcmsudGVzdC5sY2wuZGV2JA",
        NUXT_CLERK_SECRET_KEY: "sk_test_e2e_fake_secret_key",
      },
    },
  ],
});
