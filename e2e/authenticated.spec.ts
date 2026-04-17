/**
 * E2E tests for authenticated pages (dashboard, POS, inventory).
 *
 * Auth is bypassed by injecting NovaUser into localStorage via helpers.
 * The API runs in dev mode with a mock user (no Clerk required).
 *
 * These tests verify that the UI loads correctly and key elements
 * are present. They don't test full sale/inventory flows because
 * those require seeded DB data -- that's covered by integration tests.
 */

import { test, expect } from "@playwright/test";
import { loginAsMockUser } from "./helpers";

test.describe("Dashboard", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockUser(page);
  });

  test("loads and shows today's sales metric", async ({ page }) => {
    await page.goto("/");

    // The main metric card shows "vendidos hoy"
    await expect(page.getByText("vendidos hoy")).toBeVisible();
  });

  test("shows summary cards (por cobrar, stock bajo)", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByText("por cobrar")).toBeVisible();
    await expect(page.getByText("stock bajo")).toBeVisible();
  });

  test("shows sync status indicator", async ({ page }) => {
    await page.goto("/");

    // Online status shows "Actualizado"
    await expect(page.getByText("Actualizado")).toBeVisible();
  });
});

test.describe("POS (sales screen)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockUser(page);
  });

  test("loads the POS screen with product grid", async ({ page }) => {
    await page.goto("/sales");

    // The POS page should have a search input and a checkout button area
    await expect(
      page.getByPlaceholder(/Buscar producto/i),
    ).toBeVisible();
  });

  test("shows 'Cobrar' button area", async ({ page }) => {
    await page.goto("/sales");

    // The checkout button shows the total (starts at $0.00)
    await expect(page.getByText(/Cobrar/i)).toBeVisible();
  });
});

test.describe("Inventory", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockUser(page);
  });

  test("loads inventory page with search", async ({ page }) => {
    await page.goto("/inventory");

    await expect(
      page.getByPlaceholder(/Buscar/i),
    ).toBeVisible();
  });

  test("shows stock status filter buttons", async ({ page }) => {
    await page.goto("/inventory");

    // Semaphore filter buttons
    await expect(page.getByText("Todos")).toBeVisible();
  });
});

test.describe("Settings (owner only)", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockUser(page);
  });

  test("loads settings hub with sections", async ({ page }) => {
    await page.goto("/settings");

    await expect(page.getByText("Configuracion")).toBeVisible();
    await expect(page.getByText("Equipo")).toBeVisible();
  });

  test("team management page loads", async ({ page }) => {
    await page.goto("/settings/team");

    await expect(page.getByText("Equipo")).toBeVisible();
    await expect(page.getByText("Agregar")).toBeVisible();
  });
});

test.describe("Reports", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockUser(page);
  });

  test("loads reports index with report links", async ({ page }) => {
    await page.goto("/reports");

    await expect(page.getByText(/Diario|Semanal|Financiero/i)).toBeVisible();
  });
});

test.describe("Navigation", () => {
  test.beforeEach(async ({ page }) => {
    await loginAsMockUser(page);
  });

  test("desktop sidebar has all main nav items", async ({ page }) => {
    // Force desktop viewport
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto("/");

    await expect(page.getByText("Inicio")).toBeVisible();
    await expect(page.getByText("Vender")).toBeVisible();
    await expect(page.getByText("Inventario")).toBeVisible();
    await expect(page.getByText("Clientes")).toBeVisible();
    await expect(page.getByText("Reportes")).toBeVisible();
  });

  test("mobile bottom tabs are visible", async ({ page }) => {
    // Force mobile viewport
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    // Bottom tabs should be visible on mobile
    await expect(page.getByText("Inicio")).toBeVisible();
    await expect(page.getByText("Vender")).toBeVisible();
  });
});
