import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E test configuration.
 *
 * NOTE: E2E tests require both servers running locally.
 * Clerk's @clerk/nuxt module is incompatible with fake credentials
 * in SSR mode, so these tests cannot run in CI without real Clerk keys.
 *
 * To run locally:
 *   1. Start API: cd apps/api && npm run dev
 *   2. Start Web: cd apps/web && npm run dev
 *   3. Run tests: npm run e2e
 *
 * Auth bypass: inject NovaUser into localStorage via helpers.ts.
 * API must run without CLERK_SECRET_KEY (dev mock user).
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
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
});
