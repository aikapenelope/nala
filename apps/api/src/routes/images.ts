/**
 * Public image proxy routes (no auth required).
 *
 * Product images are not sensitive — they're the same images shown in the
 * public storefront catalog. Serving them without auth allows <img> tags
 * to load them directly (browsers don't send Authorization headers for
 * image requests).
 *
 * Routes:
 * GET /images/products/:productId           - Primary image (sort_order=0)
 * GET /images/products/:productId/:imageId  - Specific image by ID
 */

import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and } from "drizzle-orm";
import { products, productImages } from "@nova/db";
import { tryGetDb } from "../db";
import {
  getProductImageStream,
  isStorageConfigured,
} from "../services/storage";

export const images = new Hono();

/** Validate UUID format. */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Stream an image from MinIO to the browser with caching headers.
 * Shared by both the primary and specific image endpoints.
 *
 * Sets Content-Length when available (required by iOS Safari for
 * reliable image rendering in <img> tags).
 */
async function streamImage(c: Context, storageKey: string) {
  const result = await getProductImageStream(storageKey);
  if (!result) {
    return c.json({ error: "Image not found in storage" }, 404);
  }

  // ETag-based caching: browser revalidates when image changes (re-upload).
  if (result.etag) {
    const ifNoneMatch = c.req.header("If-None-Match");
    if (ifNoneMatch && ifNoneMatch === result.etag) {
      return new Response(null, { status: 304 });
    }
    c.header("ETag", result.etag);
  }

  c.header("Content-Type", result.contentType);
  c.header("Cache-Control", "public, max-age=3600, must-revalidate");

  // Content-Length is critical for iOS Safari — without it, images
  // from streaming responses may not render in <img> tags.
  if (result.contentLength) {
    c.header("Content-Length", String(result.contentLength));
  }

  return c.body(result.body);
}

/**
 * GET /images/products/:productId - Serve the primary product image.
 *
 * Backward compatible: uses products.image_url (denormalized cache).
 * Falls back to the first image in product_images if image_url is empty.
 */
images.get("/products/:productId", async (c) => {
  const productId = c.req.param("productId");

  if (!UUID_REGEX.test(productId)) {
    return c.json({ error: "Invalid product ID" }, 400);
  }

  if (!isStorageConfigured) {
    return c.json({ error: "Storage not configured" }, 503);
  }

  const db = tryGetDb();
  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  // Fast path: use the denormalized image_url on the product
  const [product] = await db
    .select({ imageUrl: products.imageUrl, isActive: products.isActive })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product?.isActive) {
    return c.json({ error: "Product not found" }, 404);
  }

  // Try denormalized cache first, then fall back to product_images table
  let storageKey = product.imageUrl;
  if (!storageKey) {
    const [primaryImage] = await db
      .select({ storageKey: productImages.storageKey })
      .from(productImages)
      .where(eq(productImages.productId, productId))
      .orderBy(productImages.sortOrder)
      .limit(1);
    storageKey = primaryImage?.storageKey ?? null;
  }

  if (!storageKey) {
    return c.json({ error: "No image" }, 404);
  }

  return streamImage(c, storageKey);
});

/**
 * GET /images/products/:productId/:imageId - Serve a specific product image.
 *
 * Used by the storefront carousel and product detail gallery.
 */
images.get("/products/:productId/:imageId", async (c) => {
  const productId = c.req.param("productId");
  const imageId = c.req.param("imageId");

  if (!UUID_REGEX.test(productId) || !UUID_REGEX.test(imageId)) {
    return c.json({ error: "Invalid ID" }, 400);
  }

  if (!isStorageConfigured) {
    return c.json({ error: "Storage not configured" }, 503);
  }

  const db = tryGetDb();
  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  // Look up the specific image
  const [image] = await db
    .select({ storageKey: productImages.storageKey })
    .from(productImages)
    .where(
      and(
        eq(productImages.id, imageId),
        eq(productImages.productId, productId),
      ),
    )
    .limit(1);

  if (!image) {
    return c.json({ error: "Image not found" }, 404);
  }

  return streamImage(c, image.storageKey);
});
