import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * Strategy: Run the Nuxt dev server (not production build) for E2E tests.
 * The dev server handles Clerk more gracefully -- it doesn't crash on
 * invalid keys, just shows warnings.
 *
 * The API runs in dev mode (no CLERK_SECRET_KEY) with a mock user.
 * Frontend auth is bypassed by injecting NovaUser into localStorage.
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
      command: "npx nuxt dev --port 3000",
      cwd: "apps/web",
      url: "http://localhost:3000",
      reuseExistingServer: !process.env.CI,
      timeout: 120000,
      env: {
        PORT: "3000",
        NUXT_PUBLIC_API_BASE: "http://localhost:3001",
        NUXT_PUBLIC_CLERK_PUBLISHABLE_KEY:
          "pk_test_Y2xlcmsudGVzdC5sY2wuZGV2JA",
      },
    },
  ],
});
