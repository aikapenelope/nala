/**
 * E2E tests for public pages (no auth required).
 *
 * Tests:
 * - Landing page loads with value proposition
 * - Landing page has CTA links to signup/login
 * - Catalog page shows error for invalid slug
 */

import { test, expect } from "@playwright/test";

test.describe("Landing page", () => {
  test("loads with Nova branding and value proposition", async ({ page }) => {
    await page.goto("/landing");

    await expect(page.getByRole("link", { name: "Nova" })).toBeVisible();
    await expect(
      page.getByText("Tu negocio completo"),
    ).toBeVisible();
    await expect(
      page.getByText("en un solo lugar"),
    ).toBeVisible();
  });

  test("has signup and login CTAs", async ({ page }) => {
    await page.goto("/landing");

    const signupLinks = page.getByRole("link", { name: /Crear cuenta|Empezar gratis/i });
    await expect(signupLinks.first()).toBeVisible();

    const loginLink = page.getByRole("link", { name: /Iniciar sesion/i });
    await expect(loginLink).toBeVisible();
  });

  test("shows business types section", async ({ page }) => {
    await page.goto("/landing");

    await expect(page.getByText("Ferreteria")).toBeVisible();
    await expect(page.getByText("Bodega")).toBeVisible();
    await expect(page.getByText("Farmacia")).toBeVisible();
  });

  test("shows pricing section", async ({ page }) => {
    await page.goto("/landing");

    await expect(page.getByText("Gratis")).toBeVisible();
    await expect(page.getByText("durante el beta")).toBeVisible();
  });
});

test.describe("Catalog (public)", () => {
  test("shows error for non-existent slug", async ({ page }) => {
    await page.goto("/catalogo/negocio-que-no-existe-xyz");

    await expect(
      page.getByText("No se encontro el catalogo"),
    ).toBeVisible();
  });
});
