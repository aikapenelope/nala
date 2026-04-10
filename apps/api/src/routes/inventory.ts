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
import { eq, and, ilike, sql, desc } from "drizzle-orm";
import {
  createProductSchema,
  updateProductSchema,
  createVariantSchema,
  createCategorySchema,
  calculateStockSemaphore,
} from "@nova/shared";
import { products, productVariants, categories, priceHistory } from "@nova/db";
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
 * - Full-text search by name (pg_trgm fuzzy match via ILIKE)
 * - Filter by category, stock semaphore status
 * - Pagination with page/limit
 * - Returns semaphore color for each product
 */
inventory.get(
  "/products",
  zValidator("query", listProductsQuery),
  async (c) => {
    const { search, categoryId, status, page, limit } = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const offset = (page - 1) * limit;

    // Build conditions
    const conditions = [
      eq(products.businessId, businessId),
      eq(products.isActive, true),
    ];

    if (categoryId) {
      conditions.push(eq(products.categoryId, categoryId));
    }

    if (search) {
      conditions.push(ilike(products.name, `%${search}%`));
    }

    // Query products
    const rows = await db
      .select()
      .from(products)
      .where(and(...conditions))
      .orderBy(desc(products.updatedAt))
      .limit(limit)
      .offset(offset);

    // Count total for pagination
    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(products)
      .where(and(...conditions));

    // Add semaphore color and filter by status if requested
    const enriched = rows.map((p) => ({
      ...p,
      semaphore: calculateStockSemaphore(
        p.stock,
        p.stockMin,
        p.stockCritical,
        p.lastSoldAt?.toISOString() ?? null,
      ),
    }));

    const filtered = status
      ? enriched.filter((p) => p.semaphore === status)
      : enriched;

    return c.json({
      products: filtered,
      total: countResult?.count ?? 0,
      page,
      limit,
    });
  },
);

/** GET /products/:id - Get single product with its variants. */
inventory.get("/products/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [product] = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.id, id),
        eq(products.businessId, businessId),
        eq(products.isActive, true),
      ),
    )
    .limit(1);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  // Fetch variants if product has them
  let variants: (typeof productVariants.$inferSelect)[] = [];
  if (product.hasVariants) {
    variants = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, id),
          eq(productVariants.isActive, true),
        ),
      );
  }

  const semaphore = calculateStockSemaphore(
    product.stock,
    product.stockMin,
    product.stockCritical,
    product.lastSoldAt?.toISOString() ?? null,
  );

  return c.json({ product: { ...product, semaphore }, variants });
});

/** POST /products - Create a new product. */
inventory.post(
  "/products",
  zValidator("json", createProductSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [product] = await db
      .insert(products)
      .values({
        businessId,
        name: data.name,
        description: data.description,
        categoryId: data.categoryId,
        sku: data.sku,
        barcode: data.barcode,
        cost: String(data.cost),
        price: String(data.price),
        stock: data.stock,
        stockMin: data.stockMin,
        stockCritical: data.stockCritical,
        hasVariants: data.hasVariants,
        imageUrl: data.imageUrl,
        expiresAt: data.expiresAt ? new Date(data.expiresAt) : undefined,
      })
      .returning();

    // Log initial price in price history
    await db.insert(priceHistory).values({
      businessId,
      productId: product.id,
      newCost: String(data.cost),
      newPrice: String(data.price),
    });

    return c.json({ product }, 201);
  },
);

/** PATCH /products/:id - Update an existing product. */
inventory.patch(
  "/products/:id",
  zValidator("json", updateProductSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");

    // Fetch current product for price change detection
    const [current] = await db
      .select()
      .from(products)
      .where(and(eq(products.id, id), eq(products.businessId, businessId)))
      .limit(1);

    if (!current) {
      return c.json({ error: "Product not found" }, 404);
    }

    // Build update values, only including fields that were provided
    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.description !== undefined)
      updateValues.description = data.description;
    if (data.categoryId !== undefined)
      updateValues.categoryId = data.categoryId;
    if (data.sku !== undefined) updateValues.sku = data.sku;
    if (data.barcode !== undefined) updateValues.barcode = data.barcode;
    if (data.cost !== undefined) updateValues.cost = String(data.cost);
    if (data.price !== undefined) updateValues.price = String(data.price);
    if (data.stock !== undefined) updateValues.stock = data.stock;
    if (data.stockMin !== undefined) updateValues.stockMin = data.stockMin;
    if (data.stockCritical !== undefined)
      updateValues.stockCritical = data.stockCritical;
    if (data.hasVariants !== undefined)
      updateValues.hasVariants = data.hasVariants;
    if (data.imageUrl !== undefined) updateValues.imageUrl = data.imageUrl;
    if (data.expiresAt !== undefined)
      updateValues.expiresAt = data.expiresAt ? new Date(data.expiresAt) : null;

    const [updated] = await db
      .update(products)
      .set(updateValues)
      .where(and(eq(products.id, id), eq(products.businessId, businessId)))
      .returning();

    // Log price changes in history
    const costChanged =
      data.cost !== undefined && String(data.cost) !== current.cost;
    const priceChanged =
      data.price !== undefined && String(data.price) !== current.price;

    if (costChanged || priceChanged) {
      await db.insert(priceHistory).values({
        businessId,
        productId: id,
        previousCost: current.cost,
        newCost: data.cost !== undefined ? String(data.cost) : current.cost,
        previousPrice: current.price,
        newPrice: data.price !== undefined ? String(data.price) : current.price,
        changedBy: user.id,
      });
    }

    return c.json({ product: updated });
  },
);

/** DELETE /products/:id - Soft-delete a product (set isActive = false). */
inventory.delete("/products/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  // Soft-delete product
  const [deleted] = await db
    .update(products)
    .set({ isActive: false, updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.businessId, businessId)))
    .returning();

  if (!deleted) {
    return c.json({ error: "Product not found" }, 404);
  }

  // Also soft-delete all variants
  await db
    .update(productVariants)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(productVariants.productId, id));

  return c.json({ message: "Product deleted", id });
});

// ============================================================
// Variants
// ============================================================

/** POST /products/:id/variants - Add a variant to a product. */
inventory.post(
  "/products/:id/variants",
  zValidator("json", createVariantSchema.omit({ productId: true })),
  async (c) => {
    const productId = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [variant] = await db
      .insert(productVariants)
      .values({
        productId,
        businessId,
        sku: data.sku,
        attributes: data.attributes,
        cost: String(data.cost),
        price: String(data.price),
        stock: data.stock,
        barcode: data.barcode,
      })
      .returning();

    // Ensure parent product has hasVariants = true
    await db
      .update(products)
      .set({ hasVariants: true, updatedAt: new Date() })
      .where(eq(products.id, productId));

    return c.json({ variant }, 201);
  },
);

/** PATCH /products/variants/:id - Update a variant. */
inventory.patch(
  "/products/variants/:id",
  zValidator("json", createVariantSchema.omit({ productId: true }).partial()),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (data.sku !== undefined) updateValues.sku = data.sku;
    if (data.attributes !== undefined)
      updateValues.attributes = data.attributes;
    if (data.cost !== undefined) updateValues.cost = String(data.cost);
    if (data.price !== undefined) updateValues.price = String(data.price);
    if (data.stock !== undefined) updateValues.stock = data.stock;
    if (data.barcode !== undefined) updateValues.barcode = data.barcode;

    const [updated] = await db
      .update(productVariants)
      .set(updateValues)
      .where(
        and(
          eq(productVariants.id, id),
          eq(productVariants.businessId, businessId),
        ),
      )
      .returning();

    if (!updated) {
      return c.json({ error: "Variant not found" }, 404);
    }

    return c.json({ variant: updated });
  },
);

/** DELETE /products/variants/:id - Soft-delete a variant. */
inventory.delete("/products/variants/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [deleted] = await db
    .update(productVariants)
    .set({ isActive: false, updatedAt: new Date() })
    .where(
      and(
        eq(productVariants.id, id),
        eq(productVariants.businessId, businessId),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: "Variant not found" }, 404);
  }

  return c.json({ message: "Variant deleted", id });
});

// ============================================================
// Categories
// ============================================================

/** GET /categories - List all categories for the current business. */
inventory.get("/categories", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const rows = await db
    .select()
    .from(categories)
    .where(
      and(eq(categories.businessId, businessId), eq(categories.isActive, true)),
    )
    .orderBy(categories.sortOrder);

  return c.json({ categories: rows });
});

/** POST /categories - Create a new category. */
inventory.post(
  "/categories",
  zValidator("json", createCategorySchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [category] = await db
      .insert(categories)
      .values({
        businessId,
        name: data.name,
        sortOrder: data.sortOrder,
      })
      .returning();

    return c.json({ category }, 201);
  },
);

export { inventory };
