/**
 * Product CRUD API routes.
 *
 * GET    /products          - List products (with filters, search, pagination)
 * GET    /products/:id      - Get single product with variants
 * POST   /products          - Create product
 * PATCH  /products/:id      - Update product
 * DELETE /products/:id      - Soft-delete product
 *
 * POST   /products/:id/variants - Add variant to product
 * PATCH  /products/variants/:id - Update variant
 * DELETE /products/variants/:id - Soft-delete variant
 *
 * GET    /categories        - List categories
 * POST   /categories        - Create category
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  createCategorySchema,
} from "@nova/shared";
import type { AppEnv } from "../types";

const inventory = new Hono<AppEnv>();

// ============================================================
// Products
// ============================================================

/** Query params for listing products. */
const listProductsQuery = z.object({
  search: z.string().optional(),
  categoryId: z.string().uuid().optional(),
  status: z.enum(["green", "yellow", "red", "gray"]).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * GET /products - List products with optional filters.
 *
 * Supports:
 * - Full-text search by name (pg_trgm fuzzy match)
 * - Filter by category, stock semaphore status
 * - Pagination with page/limit
 * - Returns semaphore color for each product
 */
inventory.get(
  "/products",
  zValidator("query", listProductsQuery),
  async (c) => {
    // TODO: Query products from DB with filters
    // const { search, categoryId, status, page, limit } = c.req.valid("query");
    // const offset = (page - 1) * limit;

    return c.json({
      products: [],
      total: 0,
      page: 1,
      limit: 50,
    });
  },
);

/** GET /products/:id - Get single product with its variants. */
inventory.get("/products/:id", async (c) => {
  // TODO: Query product + variants from DB using c.req.param("id")
  return c.json({ error: "Not connected to database" }, 503);
});

/** POST /products - Create a new product. */
inventory.post(
  "/products",
  zValidator("json", createProductSchema),
  async (c) => {
    // TODO: Insert product into DB, log price history
    // const data = c.req.valid("json");
    // const user = c.get("user");

    return c.json({ error: "Not connected to database" }, 503);
  },
);

/** PATCH /products/:id - Update an existing product. */
inventory.patch(
  "/products/:id",
  zValidator("json", updateProductSchema),
  async (c) => {
    // TODO: Update product, record price changes in price_history
    // const _id = c.req.param("id");
    // const data = c.req.valid("json");

    return c.json({ error: "Not connected to database" }, 503);
  },
);

/** DELETE /products/:id - Soft-delete a product (set isActive = false). */
inventory.delete("/products/:id", async (c) => {
  // TODO: Soft-delete product and its variants using c.req.param("id")
  return c.json({ error: "Not connected to database" }, 503);
});

// ============================================================
// Variants
// ============================================================

/** POST /products/:id/variants - Add a variant to a product. */
inventory.post(
  "/products/:id/variants",
  zValidator("json", createVariantSchema.omit({ productId: true })),
  async (c) => {
    // TODO: Insert variant, update parent product hasVariants flag
    // const productId = c.req.param("id");
    // const data = c.req.valid("json");

    return c.json({ error: "Not connected to database" }, 503);
  },
);

/** PATCH /products/variants/:id - Update a variant. */
inventory.patch(
  "/products/variants/:id",
  zValidator("json", createVariantSchema.omit({ productId: true }).partial()),
  async (c) => {
    // TODO: Update variant, record price changes
    // const _id = c.req.param("id");
    // const data = c.req.valid("json");

    return c.json({ error: "Not connected to database" }, 503);
  },
);

/** DELETE /products/variants/:id - Soft-delete a variant. */
inventory.delete("/products/variants/:id", async (c) => {
  // TODO: Soft-delete variant using c.req.param("id")
  return c.json({ error: "Not connected to database" }, 503);
});

// ============================================================
// Categories
// ============================================================

/** GET /categories - List all categories for the current business. */
inventory.get("/categories", async (c) => {
  // TODO: Query categories from DB ordered by sortOrder
  return c.json({ categories: [] });
});

/** POST /categories - Create a new category. */
inventory.post(
  "/categories",
  zValidator("json", createCategorySchema),
  async (c) => {
    // TODO: Insert category into DB
    // const data = c.req.valid("json");

    return c.json({ error: "Not connected to database" }, 503);
  },
);

export { inventory };
