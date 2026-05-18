/**
 * Public catalog API routes (no auth required).
 *
 * GET  /catalog/:slug            - Get business info + active products
 * GET  /catalog/:slug/store-info - Get store settings (payment methods, delivery)
 * POST /catalog/:slug/orders     - Create an online order
 *
 * These endpoints are intentionally unauthenticated so that anyone with the link
 * can view a business's product catalog and place orders. They do NOT use RLS
 * because there is no authenticated user context; instead they filter by slug directly.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, inArray, sql } from "drizzle-orm";
import { businesses, products, productImages, categories, storeSettings, orders, exchangeRates } from "@nova/db";
import { calculateStockSemaphore } from "@nova/shared";
import { tryGetDb } from "../db";
import { getRedis } from "../redis";
import { uploadPaymentProof, isStorageConfigured } from "../services/storage";
import { logActivity } from "../utils/audit";
import { PriceError, StockError, MinOrderError } from "../utils/errors";
import { publicRateLimit, uploadRateLimit } from "../middleware/rate-limit";
import { notifyNewOrder } from "../services/push-notifications";

export const catalog = new Hono();

/** Cache TTLs in seconds. */
const CATALOG_CACHE_TTL = 60; // 1 minute
const STORE_INFO_CACHE_TTL = 300; // 5 minutes

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
  const limit = Math.min(Math.max(Number(c.req.query("limit")) || 100, 1), 500);
  const offset = Math.max(Number(c.req.query("offset")) || 0, 0);
  const db = tryGetDb();

  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  // Try Redis cache first (keyed by slug + pagination)
  const redis = getRedis();
  const cacheKey = `catalog:${slug}:${limit}:${offset}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached));
    }
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

  // Fetch active products (paginated)
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
      sku: products.sku,
      brand: products.brand,
      hasVariants: products.hasVariants,
      isService: products.isService,
    })
    .from(products)
    .where(
      and(
        eq(products.businessId, business.id),
        eq(products.isActive, true),
      ),
    )
    .orderBy(desc(products.updatedAt))
    .limit(limit)
    .offset(offset);

  // Count total products for pagination metadata
  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(products)
    .where(
      and(
        eq(products.businessId, business.id),
        eq(products.isActive, true),
      ),
    );
  const totalProducts = countResult?.count ?? 0;

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
      imageUrl: p.imageUrl ? `/images/products/${p.id}` : null,
      images: [] as Array<{ id: string; url: string; sortOrder: number }>,
      categoryName: p.categoryId ? (categoryMap.get(p.categoryId) ?? null) : null,
      available: p.stock > 0 || p.isService,
      semaphore,
      sku: p.sku,
      brand: p.brand,
      hasVariants: p.hasVariants,
      isService: p.isService,
    };
  });

  // Batch-fetch image galleries for all products in this page.
  // Single query with IN clause — much faster than N+1 queries.
  const productIds = catalogProducts.map((p) => p.id);
  if (productIds.length > 0) {
    const allImages = await db
      .select({
        id: productImages.id,
        productId: productImages.productId,
        sortOrder: productImages.sortOrder,
      })
      .from(productImages)
      .where(inArray(productImages.productId, productIds))
      .orderBy(productImages.sortOrder);

    // Group images by product ID
    const imagesByProduct = new Map<string, typeof allImages>();
    for (const img of allImages) {
      const existing = imagesByProduct.get(img.productId) ?? [];
      existing.push(img);
      imagesByProduct.set(img.productId, existing);
    }

    // Attach images to each product
    for (const product of catalogProducts) {
      const imgs = imagesByProduct.get(product.id) ?? [];
      product.images = imgs.map((img) => ({
        id: img.id,
        url: `/images/products/${product.id}/${img.id}`,
        sortOrder: img.sortOrder,
      }));
    }
  }

  // Fetch exchange rate for Bs display (non-blocking, optional).
  // The catalog runs without RLS tenant context, but exchange_rates has
  // RLS enabled. We use a transaction to pin set_config + the query to
  // the same pooled connection, with transaction-local scope (true) so
  // the variable auto-reverts on commit — no manual cleanup needed.
  let exchangeRate: number | null = null;
  try {
    const rate = await db.transaction(async (tx) => {
      await tx.execute(
        sql`SELECT set_config('app.current_business_id', ${business.id}, true)`,
      );
      const [latest] = await tx
        .select({ rateBcv: exchangeRates.rateBcv })
        .from(exchangeRates)
        .where(eq(exchangeRates.businessId, business.id))
        .orderBy(desc(exchangeRates.date))
        .limit(1);
      return latest ?? null;
    });
    exchangeRate = rate ? Number(rate.rateBcv) : null;
  } catch {
    // Rate not configured -- that's fine, just don't show Bs prices
  }

  const responseData = {
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
    exchangeRate,
    pagination: {
      total: totalProducts,
      limit,
      offset,
      hasMore: offset + productRows.length < totalProducts,
    },
  };

  // Cache the response
  if (redis) {
    redis.set(cacheKey, JSON.stringify(responseData), "EX", CATALOG_CACHE_TTL);
  }

  return c.json(responseData);
});

// ============================================================
// Store info (payment methods, delivery config)
// ============================================================

/**
 * GET /catalog/:slug/store-info - Public store configuration.
 *
 * Returns payment methods, delivery options, and store status.
 * Used by the storefront checkout to show payment instructions.
 */
catalog.get("/:slug/store-info", async (c) => {
  const slug = c.req.param("slug");
  const db = tryGetDb();

  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  // Try Redis cache first
  const redis = getRedis();
  const cacheKey = `store-info:${slug}`;
  if (redis) {
    const cached = await redis.get(cacheKey);
    if (cached) {
      return c.json(JSON.parse(cached));
    }
  }

  // Look up business by slug
  const [business] = await db
    .select({ id: businesses.id, name: businesses.name })
    .from(businesses)
    .where(and(eq(businesses.slug, slug), eq(businesses.isActive, true)))
    .limit(1);

  if (!business) {
    return c.json({ error: "Business not found" }, 404);
  }

  // Fetch store settings
  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.businessId, business.id))
    .limit(1);

  if (!settings || !settings.storeEnabled) {
    return c.json({ error: "Store not available", code: "STORE_DISABLED" }, 404);
  }

  const responseData = {
    storeEnabled: settings.storeEnabled,
    paymentMethods: settings.paymentMethods,
    deliveryEnabled: settings.deliveryEnabled,
    deliveryFee: Number(settings.deliveryFee),
    deliveryZones: settings.deliveryZones,
    welcomeMessage: settings.welcomeMessage,
    minOrderAmount: Number(settings.minOrderAmount),
    businessHours: settings.businessHours ?? null,
  };

  // Cache the response
  if (redis) {
    redis.set(cacheKey, JSON.stringify(responseData), "EX", STORE_INFO_CACHE_TTL);
  }

  return c.json(responseData);
});

// ============================================================
// Create order (public, rate-limited)
// ============================================================

/** Order item schema for validation. */
const orderItemSchema = z.object({
  productId: z.string().uuid(),
  name: z.string().min(1),
  price: z.number().min(0),
  quantity: z.number().int().min(1).max(100),
  lineTotal: z.number().min(0),
});

const createOrderSchema = z.object({
  customerName: z.string().min(1).max(200),
  customerPhone: z.string().min(5).max(30),
  customerNotes: z.string().max(500).optional(),
  items: z.array(orderItemSchema).min(1).max(20),
  paymentMethod: z.string().min(1).max(50),
  paymentReference: z.string().max(100).optional(),
  deliveryRequested: z.boolean().default(false),
  idempotencyKey: z.string().max(64).optional(),
});

/**
 * POST /catalog/:slug/orders - Create an online order.
 *
 * Validates stock availability, calculates totals, and saves the order.
 * Returns the order ID and a pre-built WhatsApp link for the customer.
 */
catalog.post(
  "/:slug/orders",
  publicRateLimit,
  zValidator("json", createOrderSchema),
  async (c) => {
    const slug = c.req.param("slug");
    const db = tryGetDb();

    if (!db) {
      return c.json({ error: "Service unavailable" }, 503);
    }

    // Look up business
    const [business] = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        whatsappNumber: businesses.whatsappNumber,
      })
      .from(businesses)
      .where(and(eq(businesses.slug, slug), eq(businesses.isActive, true)))
      .limit(1);

    if (!business) {
      return c.json({ error: "Business not found" }, 404);
    }

    // Verify store is enabled
    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.businessId, business.id))
      .limit(1);

    if (!settings || !settings.storeEnabled) {
      return c.json({ error: "Store not accepting orders" }, 403);
    }

    const data = c.req.valid("json");

    // Idempotency check: if key provided, check if order already exists
    const redis = getRedis();
    if (data.idempotencyKey && redis) {
      const idempotencyRedisKey = `order-idem:${business.id}:${data.idempotencyKey}`;
      const existingOrderId = await redis.get(idempotencyRedisKey);
      if (existingOrderId) {
        // Return the existing order (duplicate request)
        return c.json(
          { orderId: existingOrderId, waLink: null, message: "Pedido ya registrado" },
          201,
        );
      }
    }

    const deliveryFee =
      data.deliveryRequested && settings.deliveryEnabled
        ? Number(settings.deliveryFee)
        : 0;

    // Atomic stock + price validation + order creation inside a transaction.
    // SELECT ... FOR UPDATE locks the product rows to prevent race conditions.
    // Totals are recalculated server-side using DB prices to prevent manipulation.
    const productIds = data.items.map((item) => item.productId);

    let orderId: string;
    let serverTotal: number;
    let serverItems: Array<{ productId: string; name: string; price: number; quantity: number; lineTotal: number }>;
    try {
      const result = await db.transaction(async (tx) => {
        // Lock product rows for the duration of this transaction
        const productRows = await tx
          .select({ id: products.id, stock: products.stock, price: products.price })
          .from(products)
          .where(
            and(
              eq(products.businessId, business.id),
              eq(products.isActive, true),
              inArray(products.id, productIds),
            ),
          )
          .for("update");

        const productMap = new Map(productRows.map((p) => [p.id, p]));

        // Check each item has sufficient stock and valid price
        const stockErrors: string[] = [];
        const priceErrors: string[] = [];
        for (const item of data.items) {
          const product = productMap.get(item.productId);
          if (!product) {
            stockErrors.push(`Producto no encontrado: ${item.name}`);
          } else {
            if (product.stock < item.quantity) {
              stockErrors.push(
                `Stock insuficiente para ${item.name} (disponible: ${product.stock})`,
              );
            }
            // Validate price: client-sent price must match DB price (1 cent tolerance)
            const dbPrice = Number(product.price);
            if (Math.abs(item.price - dbPrice) > 0.01) {
              priceErrors.push(
                `Precio incorrecto para ${item.name}: enviado $${item.price.toFixed(2)}, actual $${dbPrice.toFixed(2)}`,
              );
            }
          }
        }

        if (priceErrors.length > 0) {
          throw new PriceError(priceErrors);
        }

        if (stockErrors.length > 0) {
          throw new StockError(stockErrors.join("; "));
        }

        // Recalculate totals server-side using DB prices (prevents client manipulation)
        const subtotal = data.items.reduce((sum, item) => {
          const dbPrice = Number(productMap.get(item.productId)?.price ?? item.price);
          return sum + dbPrice * item.quantity;
        }, 0);
        const total = subtotal + deliveryFee;

        // Enforce minimum order amount
        const minOrder = Number(settings.minOrderAmount);
        if (minOrder > 0 && total < minOrder) {
          throw new MinOrderError(
            `Monto minimo de pedido: $${minOrder.toFixed(2)}`,
          );
        }

        // Build server-validated items snapshot with DB prices
        const validatedItems = data.items.map((item) => {
          const dbPrice = Number(productMap.get(item.productId)?.price ?? item.price);
          return {
            productId: item.productId,
            name: item.name,
            price: dbPrice,
            quantity: item.quantity,
            lineTotal: dbPrice * item.quantity,
          };
        });

        // Create the order (stock is NOT decremented here, only on confirm)
        const [order] = await tx
          .insert(orders)
          .values({
            businessId: business.id,
            customerName: data.customerName,
            customerPhone: data.customerPhone,
            customerNotes: data.customerNotes,
            items: validatedItems,
            subtotal: String(subtotal),
            deliveryFee: String(deliveryFee),
            total: String(total),
            paymentMethod: data.paymentMethod,
            paymentReference: data.paymentReference,
          })
          .returning({ id: orders.id });

        return { id: order.id, total, validatedItems };
      });

      orderId = result.id;
      serverTotal = result.total;
      serverItems = result.validatedItems;
    } catch (err) {
      if (err instanceof PriceError) {
        return c.json(
          { error: "Precio incorrecto", details: err.details },
          409,
        );
      }
      if (err instanceof StockError) {
        return c.json(
          { error: "Stock insuficiente", details: [err.message] },
          409,
        );
      }
      if (err instanceof MinOrderError) {
        return c.json({ error: err.message }, 400);
      }
      throw err;
    }

    // Store idempotency key (expires in 10 minutes)
    if (data.idempotencyKey && redis) {
      const idempotencyRedisKey = `order-idem:${business.id}:${data.idempotencyKey}`;
      redis.set(idempotencyRedisKey, orderId, "EX", 600);
    }

    // Log order creation (fire-and-forget, no userId for public endpoint)
    logActivity({
      db,
      businessId: business.id,
      userId: business.id, // Use businessId as actor for public orders
      action: "order_created",
      detail: `Pedido online ${orderId.slice(0, 8)} - ${data.customerName} - $${serverTotal.toFixed(2)}`,
    });

    // Send push notification to business owner (fire-and-forget)
    notifyNewOrder(db, business.id, {
      customerName: data.customerName,
      total: serverTotal,
      orderId,
    }).catch(() => {
      // Push is best-effort, don't block the order response
    });

    // Build WhatsApp link with order summary (using server-validated items)
    const itemsSummary = serverItems
      .map((item) => `• ${item.name} x${item.quantity} - $${item.lineTotal.toFixed(2)}`)
      .join("\n");

    const waMessage = [
      `Nuevo pedido de ${data.customerName}`,
      `Telefono: ${data.customerPhone}`,
      "",
      itemsSummary,
      "",
      deliveryFee > 0 ? `Delivery: $${deliveryFee.toFixed(2)}` : "",
      `Total: $${serverTotal.toFixed(2)}`,
      "",
      `Metodo de pago: ${data.paymentMethod}`,
      data.paymentReference ? `Referencia: ${data.paymentReference}` : "",
      data.customerNotes ? `Nota: ${data.customerNotes}` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const waPhone = business.whatsappNumber?.replace(/[^0-9]/g, "") ?? "";
    const waLink = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(waMessage)}`
      : null;

    return c.json(
      {
        orderId,
        waLink,
        message: "Pedido creado exitosamente",
      },
      201,
    );
  },
);

// ============================================================
// Upload payment proof (public, rate-limited)
// ============================================================

/**
 * POST /catalog/:slug/orders/:id/proof - Upload payment proof image.
 *
 * Accepts multipart/form-data with a single file field "proof".
 * Max 5MB, only JPEG/PNG/WebP.
 * Stores in MinIO and updates the order's payment_proof_url.
 */
catalog.post("/:slug/orders/:id/proof", uploadRateLimit, async (c) => {
  const slug = c.req.param("slug") as string;
  const orderId = c.req.param("id") as string;
  const db = tryGetDb();

  if (!db) {
    return c.json({ error: "Service unavailable" }, 503);
  }

  if (!isStorageConfigured) {
    return c.json({ error: "File storage not configured" }, 503);
  }

  // Validate UUID format for orderId
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(orderId)) {
    return c.json({ error: "Invalid order ID" }, 400);
  }

  // Look up business by slug
  const [business] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(and(eq(businesses.slug, slug), eq(businesses.isActive, true)))
    .limit(1);

  if (!business) {
    return c.json({ error: "Business not found" }, 404);
  }

  // Verify order exists and belongs to this business
  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, orderId), eq(orders.businessId, business.id)))
    .limit(1);

  if (!order) {
    return c.json({ error: "Order not found" }, 404);
  }

  // Only allow proof upload for pending orders
  if (order.status !== "pending") {
    return c.json(
      { error: "Solo se puede subir comprobante para pedidos pendientes" },
      400,
    );
  }

  // Parse multipart form data
  const formData = await c.req.formData();
  const file = formData.get("proof");

  if (!file || !(file instanceof File)) {
    return c.json({ error: "No se recibio archivo. Campo: proof" }, 400);
  }

  // Validate content type
  const contentType = file.type;
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    return c.json(
      { error: "Tipo de archivo no permitido. Solo JPEG, PNG o WebP." },
      400,
    );
  }

  // Validate size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    return c.json({ error: "Archivo demasiado grande. Maximo 5MB." }, 400);
  }

  // Read file into buffer
  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  try {
    // Upload to MinIO
    const { key } = await uploadPaymentProof(
      business.id,
      orderId,
      buffer,
      contentType,
    );

    // Update order with proof key
    await db
      .update(orders)
      .set({
        paymentProofUrl: key,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, orderId));

    return c.json({ success: true, key }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Upload failed";
    return c.json({ error: message }, 500);
  }
});
