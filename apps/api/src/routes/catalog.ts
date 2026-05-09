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
import { eq, and, desc, inArray } from "drizzle-orm";
import { businesses, products, categories, storeSettings, orders } from "@nova/db";
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

  return c.json({
    storeEnabled: settings.storeEnabled,
    paymentMethods: settings.paymentMethods,
    deliveryEnabled: settings.deliveryEnabled,
    deliveryFee: Number(settings.deliveryFee),
    deliveryZones: settings.deliveryZones,
    welcomeMessage: settings.welcomeMessage,
    minOrderAmount: Number(settings.minOrderAmount),
  });
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
});

/**
 * POST /catalog/:slug/orders - Create an online order.
 *
 * Validates stock availability, calculates totals, and saves the order.
 * Returns the order ID and a pre-built WhatsApp link for the customer.
 */
catalog.post(
  "/:slug/orders",
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

    // Validate stock availability for all items
    const productIds = data.items.map((item) => item.productId);
    const productRows = await db
      .select({ id: products.id, stock: products.stock, price: products.price })
      .from(products)
      .where(
        and(
          eq(products.businessId, business.id),
          eq(products.isActive, true),
          inArray(products.id, productIds),
        ),
      );

    const productMap = new Map(productRows.map((p) => [p.id, p]));

    // Check each item has sufficient stock
    const stockErrors: string[] = [];
    for (const item of data.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        stockErrors.push(`Producto no encontrado: ${item.name}`);
      } else if (product.stock < item.quantity) {
        stockErrors.push(
          `Stock insuficiente para ${item.name} (disponible: ${product.stock})`,
        );
      }
    }

    if (stockErrors.length > 0) {
      return c.json({ error: "Stock insuficiente", details: stockErrors }, 409);
    }

    // Calculate totals
    const subtotal = data.items.reduce((sum, item) => sum + item.lineTotal, 0);
    const deliveryFee =
      data.deliveryRequested && settings.deliveryEnabled
        ? Number(settings.deliveryFee)
        : 0;
    const total = subtotal + deliveryFee;

    // Enforce minimum order amount
    if (Number(settings.minOrderAmount) > 0 && total < Number(settings.minOrderAmount)) {
      return c.json(
        { error: `Monto minimo de pedido: $${Number(settings.minOrderAmount).toFixed(2)}` },
        400,
      );
    }

    // Create the order
    const [order] = await db
      .insert(orders)
      .values({
        businessId: business.id,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerNotes: data.customerNotes,
        items: data.items,
        subtotal: String(subtotal),
        deliveryFee: String(deliveryFee),
        total: String(total),
        paymentMethod: data.paymentMethod,
        paymentReference: data.paymentReference,
      })
      .returning({ id: orders.id, createdAt: orders.createdAt });

    // Build WhatsApp link with order summary
    const itemsSummary = data.items
      .map((item) => `• ${item.name} x${item.quantity} - $${item.lineTotal.toFixed(2)}`)
      .join("\n");

    const waMessage = [
      `Nuevo pedido de ${data.customerName}`,
      `Telefono: ${data.customerPhone}`,
      "",
      itemsSummary,
      "",
      deliveryFee > 0 ? `Delivery: $${deliveryFee.toFixed(2)}` : "",
      `Total: $${total.toFixed(2)}`,
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
        orderId: order.id,
        waLink,
        message: "Pedido creado exitosamente",
      },
      201,
    );
  },
);
