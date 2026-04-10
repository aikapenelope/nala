/**
 * E2E smoke test - verifies the app loads and basic navigation works.
 * Run with: npx playwright test
 */

import { test, expect } from "@playwright/test";

test("homepage loads with Nova title", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/Nova/);
});

test("navigation links are visible on desktop", async ({ page }) => {
  await page.goto("/");
  // Sidebar should have navigation items
  await expect(page.getByText("Inicio")).toBeVisible();
  await expect(page.getByText("Vender")).toBeVisible();
  await expect(page.getByText("Inventario")).toBeVisible();
});
