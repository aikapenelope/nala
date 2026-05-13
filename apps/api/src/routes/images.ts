/**
 * Public image proxy routes (no auth required).
 *
 * Product images are not sensitive — they're the same images shown in the
 * public storefront catalog. Serving them without auth allows <img> tags
 * to load them directly (browsers don't send Authorization headers for
 * image requests).
 *
 * GET /images/products/:id - Serve a product image from MinIO
 */

import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { products } from "@nova/db";
import { tryGetDb } from "../db";
import {
  getProductImageStream,
  isStorageConfigured,
} from "../services/storage";

export const images = new Hono();

// Override Cross-Origin-Resource-Policy for all image routes.
// The global secureHeaders() middleware sets it to "same-origin", which blocks
// <img> tags on the frontend (https://novaincs.com) from loading images served
// by the API (https://api.novaincs.com). Product images are public data, so
// "cross-origin" is safe here.
images.use("*", async (c, next) => {
  await next();
  c.header("Cross-Origin-Resource-Policy", "cross-origin");
});

/**
 * GET /images/products/:id - Serve product image via API proxy.
 *
 * Public endpoint. MinIO is on a private network, so this proxies the
 * image bytes to the browser with proper caching headers.
 *
 * Security: product images are public data (shown in storefront).
 * The endpoint only serves images for active products that exist in the DB.
 */
images.get("/products/:id", async (c) => {
  const productId = c.req.param("id");

  // Validate UUID format
  const uuidRegex =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(productId)) {
    return c.json({ error: "Invalid product ID" }, 400);
  }

  if (!isStorageConfigured) {
    return c.json({ error: "Storage not configured" }, 503);
  }

  const db = tryGetDb();
  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  // Fetch product image key by ID.
  // No tenant context needed — product images are public (same as storefront catalog).
  const [product] = await db
    .select({ imageUrl: products.imageUrl, isActive: products.isActive })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product?.imageUrl || !product.isActive) {
    return c.json({ error: "Image not found" }, 404);
  }

  const result = await getProductImageStream(product.imageUrl);
  if (!result) {
    return c.json({ error: "Image not found in storage" }, 404);
  }

  // ETag-based caching: browser revalidates when image changes (re-upload).
  if (result.etag) {
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch && ifNoneMatch === result.etag) {
      return c.body(null, 304);
    }
    c.header("ETag", result.etag);
  }

  c.header("Content-Type", result.contentType);
  c.header("Cache-Control", "public, max-age=3600, must-revalidate");

  return c.body(result.body);
});
