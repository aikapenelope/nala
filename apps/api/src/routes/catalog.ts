/**
 * Public catalog API routes (no auth required).
 *
 * GET /catalog/:slug - Get business info + active products for the public catalog page.
 *
 * This endpoint is intentionally unauthenticated so that anyone with the link
 * can view a business's product catalog. It does NOT use RLS because there is
 * no authenticated user context; instead it filters by slug directly.
 */

import { Hono } from "hono";
import { eq, and, desc } from "drizzle-orm";
import { businesses, products, categories } from "@nova/db";
import { calculateStockSemaphore } from "@nova/shared";
import { tryGetDb } from "../db";

export const catalog = new Hono();

/**
 * GET /catalog/:slug - Public product catalog for a business.
 *
 * Returns business name, type, WhatsApp number, and active products
 * grouped by category. Only includes products with stock > 0.
 *
 * No auth required. No RLS context needed (queries filter by slug).
 */
catalog.get("/:slug", async (c) => {
  const slug = c.req.param("slug");
  const db = tryGetDb();

  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  // Look up business by slug
  const [business] = await db
    .select({
      id: businesses.id,
      name: businesses.name,
      type: businesses.type,
      phone: businesses.phone,
      address: businesses.address,
      slug: businesses.slug,
      whatsappNumber: businesses.whatsappNumber,
    })
    .from(businesses)
    .where(and(eq(businesses.slug, slug), eq(businesses.isActive, true)))
    .limit(1);

  if (!business) {
    return c.json({ error: "Business not found" }, 404);
  }

  // Fetch active products with stock > 0
  const productRows = await db
    .select({
      id: products.id,
      name: products.name,
      description: products.description,
      price: products.price,
      stock: products.stock,
      stockMin: products.stockMin,
      stockCritical: products.stockCritical,
      categoryId: products.categoryId,
      imageUrl: products.imageUrl,
      lastSoldAt: products.lastSoldAt,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, business.id),
        eq(products.isActive, true),
      ),
    )
    .orderBy(desc(products.updatedAt));

  // Fetch categories for this business
  const categoryRows = await db
    .select({
      id: categories.id,
      name: categories.name,
      sortOrder: categories.sortOrder,
    })
    .from(categories)
    .where(
      and(
        eq(categories.businessId, business.id),
        eq(categories.isActive, true),
      ),
    )
    .orderBy(categories.sortOrder);

  // Build category map for grouping
  const categoryMap = new Map(categoryRows.map((cat) => [cat.id, cat.name]));

  // Enrich products with category name and availability status
  const catalogProducts = productRows.map((p) => {
    const semaphore = calculateStockSemaphore(
      p.stock,
      p.stockMin,
      p.stockCritical,
      p.lastSoldAt?.toISOString() ?? null,
    );

    return {
      id: p.id,
      name: p.name,
      description: p.description,
      price: Number(p.price),
      imageUrl: p.imageUrl,
      categoryName: p.categoryId ? (categoryMap.get(p.categoryId) ?? null) : null,
      available: p.stock > 0,
      semaphore,
    };
  });

  return c.json({
    business: {
      name: business.name,
      type: business.type,
      phone: business.phone,
      address: business.address,
      slug: business.slug,
      whatsappNumber: business.whatsappNumber,
    },
    categories: categoryRows,
    products: catalogProducts,
  });
});
