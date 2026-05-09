/**
 * Orders management routes (protected, auth required).
 *
 * GET    /orders              - List orders (with filters)
 * GET    /orders/:id          - Get order detail
 * PATCH  /orders/:id/confirm  - Confirm order (descounts stock)
 * PATCH  /orders/:id/deliver  - Mark as delivered
 * PATCH  /orders/:id/cancel   - Cancel order
 *
 * GET    /store-settings      - Get store configuration
 * PATCH  /store-settings      - Update store configuration
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, sql } from "drizzle-orm";
import {
  orders,
  storeSettings,
  products,
  sales,
  saleItems,
  salePayments,
  customers,
} from "@nova/db";
import { logActivity } from "../utils/audit";
import { cancelStaleOrdersForBusiness } from "../utils/auto-cancel";
import { validateUuidParam } from "../middleware/validate-uuid";
import { getProofUrl, isStorageConfigured } from "../services/storage";
import type { AppEnv } from "../types";

const ordersRoutes = new Hono<AppEnv>();

// ============================================================
// List orders
// ============================================================

const listOrdersQuery = z.object({
  status: z.enum(["pending", "confirmed", "delivered", "cancelled"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

/** GET /orders - List orders with optional status filter. */
ordersRoutes.get("/orders", zValidator("query", listOrdersQuery), async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const { status, limit, offset } = c.req.valid("query");

  const conditions = [eq(orders.businessId, businessId)];
  if (status) {
    conditions.push(eq(orders.status, status));
  }

  const rows = await db
    .select({
      id: orders.id,
      customerName: orders.customerName,
      customerPhone: orders.customerPhone,
      total: orders.total,
      paymentMethod: orders.paymentMethod,
      status: orders.status,
      createdAt: orders.createdAt,
      confirmedAt: orders.confirmedAt,
      deliveredAt: orders.deliveredAt,
    })
    .from(orders)
    .where(and(...conditions))
    .orderBy(desc(orders.createdAt))
    .limit(limit)
    .offset(offset);

  // Count pending for badge
  const [{ count: pendingCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(orders)
    .where(
      and(eq(orders.businessId, businessId), eq(orders.status, "pending")),
    );

  return c.json({
    orders: rows.map((r) => ({ ...r, total: Number(r.total) })),
    pendingCount,
  });
});

// ============================================================
// Order detail
// ============================================================

/** GET /orders/:id - Full order detail. */
ordersRoutes.get("/orders/:id", validateUuidParam, async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const id = c.req.param("id");

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
    .limit(1);

  if (!order) {
    return c.json({ error: "Pedido no encontrado" }, 404);
  }

  return c.json({
    order: {
      ...order,
      subtotal: Number(order.subtotal),
      deliveryFee: Number(order.deliveryFee),
      total: Number(order.total),
      exchangeRate: order.exchangeRate ? Number(order.exchangeRate) : null,
      totalBs: order.totalBs ? Number(order.totalBs) : null,
    },
  });
});

// ============================================================
// Proof URL (presigned)
// ============================================================

/** GET /orders/:id/proof-url - Get presigned URL for payment proof image. */
ordersRoutes.get("/orders/:id/proof-url", validateUuidParam, async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const id = c.req.param("id");

  if (!isStorageConfigured) {
    return c.json({ error: "Storage not configured" }, 503);
  }

  const [order] = await db
    .select({ paymentProofUrl: orders.paymentProofUrl })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
    .limit(1);

  if (!order) {
    return c.json({ error: "Pedido no encontrado" }, 404);
  }

  if (!order.paymentProofUrl) {
    return c.json({ error: "No hay comprobante de pago" }, 404);
  }

  const url = await getProofUrl(order.paymentProofUrl);
  return c.json({ url });
});

// ============================================================
// Confirm order (descounts stock)
// ============================================================

/** PATCH /orders/:id/confirm - Confirm payment and decrement stock. Creates a sale record. */
ordersRoutes.patch("/orders/:id/confirm", validateUuidParam, async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const user = c.get("user");
  const id = c.req.param("id");

  const [order] = await db
    .select()
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
    .limit(1);

  if (!order) {
    return c.json({ error: "Pedido no encontrado" }, 404);
  }

  if (order.status !== "pending") {
    return c.json(
      { error: `No se puede confirmar un pedido con estado: ${order.status}` },
      400,
    );
  }

  // Decrement stock for each item in a transaction + create sale
  const orderItems = order.items as Array<{
    productId: string;
    quantity: number;
    name: string;
    price: number;
    lineTotal: number;
  }>;

  await db.transaction(async (tx) => {
    // 1. Decrement stock
    for (const item of orderItems) {
      const result = await tx
        .update(products)
        .set({ stock: sql`stock - ${item.quantity}` })
        .where(
          and(
            eq(products.id, item.productId),
            eq(products.businessId, businessId),
            sql`stock >= ${item.quantity}`,
          ),
        )
        .returning({ id: products.id });

      if (result.length === 0) {
        throw new Error(`Stock insuficiente para: ${item.name}`);
      }
    }

    // 2. Update order status
    await tx
      .update(orders)
      .set({
        status: "confirmed",
        confirmedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    // 3. Find or create customer by phone
    let customerId: string | null = null;
    if (order.customerPhone) {
      const [existing] = await tx
        .select({ id: customers.id })
        .from(customers)
        .where(
          and(
            eq(customers.businessId, businessId),
            eq(customers.phone, order.customerPhone),
          ),
        )
        .limit(1);

      if (existing) {
        customerId = existing.id;
      } else {
        const [newCustomer] = await tx
          .insert(customers)
          .values({
            businessId,
            name: order.customerName,
            phone: order.customerPhone,
          })
          .returning({ id: customers.id });
        customerId = newCustomer.id;
      }
    }

    // 4. Create sale record (channel: storefront)
    const [sale] = await tx
      .insert(sales)
      .values({
        businessId,
        userId: user.id,
        customerId,
        totalUsd: order.total,
        channel: "storefront",
        notes: `Pedido online #${id.slice(0, 8)}`,
      })
      .returning({ id: sales.id });

    // 5. Create sale items
    for (const item of orderItems) {
      await tx.insert(saleItems).values({
        saleId: sale.id,
        businessId,
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: String(item.price),
        lineTotal: String(item.lineTotal),
      });
    }

    // 6. Create sale payment
    await tx.insert(salePayments).values({
      saleId: sale.id,
      businessId,
      method: order.paymentMethod,
      amountUsd: order.total,
      reference: order.paymentReference,
    });
  });

  logActivity({
    db,
    businessId,
    userId: user.id,
    action: "order_confirmed",
    detail: `Pedido ${id.slice(0, 8)} - $${Number(order.total).toFixed(2)} → Venta creada`,
  });

  return c.json({ success: true, status: "confirmed" });
});

// ============================================================
// Deliver order
// ============================================================

/** PATCH /orders/:id/deliver - Mark order as delivered. */
ordersRoutes.patch("/orders/:id/deliver", validateUuidParam, async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");
  const user = c.get("user");
  const id = c.req.param("id");

  const [order] = await db
    .select({ id: orders.id, status: orders.status })
    .from(orders)
    .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
    .limit(1);

  if (!order) {
    return c.json({ error: "Pedido no encontrado" }, 404);
  }

  if (order.status !== "confirmed") {
    return c.json(
      { error: "Solo se pueden entregar pedidos confirmados" },
      400,
    );
  }

  await db
    .update(orders)
    .set({
      status: "delivered",
      deliveredAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(orders.id, id));

  logActivity({
    db,
    businessId,
    userId: user.id,
    action: "order_delivered",
    detail: `Pedido ${id.slice(0, 8)}`,
  });

  return c.json({ success: true, status: "delivered" });
});

// ============================================================
// Cancel order
// ============================================================

const cancelOrderSchema = z.object({
  reason: z.string().min(1).max(500),
});

/** PATCH /orders/:id/cancel - Cancel an order. */
ordersRoutes.patch(
  "/orders/:id/cancel",
  validateUuidParam,
  zValidator("json", cancelOrderSchema),
  async (c) => {
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");
    const id = c.req.param("id");
    const { reason } = c.req.valid("json");

    const [order] = await db
      .select({ id: orders.id, status: orders.status })
      .from(orders)
      .where(and(eq(orders.id, id), eq(orders.businessId, businessId)))
      .limit(1);

    if (!order) {
      return c.json({ error: "Pedido no encontrado" }, 404);
    }

    if (order.status === "delivered" || order.status === "cancelled") {
      return c.json(
        { error: `No se puede cancelar un pedido con estado: ${order.status}` },
        400,
      );
    }

    await db
      .update(orders)
      .set({
        status: "cancelled",
        cancelledAt: new Date(),
        cancelReason: reason,
        updatedAt: new Date(),
      })
      .where(eq(orders.id, id));

    logActivity({
      db,
      businessId,
      userId: user.id,
      action: "order_cancelled",
      detail: `Pedido ${id.slice(0, 8)} - ${reason}`,
    });

    return c.json({ success: true, status: "cancelled" });
  },
);

// ============================================================
// Store Settings
// ============================================================

const updateStoreSettingsSchema = z.object({
  storeEnabled: z.boolean().optional(),
  paymentMethods: z
    .array(
      z.object({
        method: z.string().min(1),
        label: z.string().min(1),
        details: z.record(z.string()),
      }),
    )
    .optional(),
  deliveryEnabled: z.boolean().optional(),
  deliveryFee: z.number().min(0).optional(),
  deliveryZones: z.string().max(500).optional().nullable(),
  welcomeMessage: z.string().max(500).optional().nullable(),
  minOrderAmount: z.number().min(0).optional(),
});

/** GET /store-settings - Get current store configuration. */
ordersRoutes.get("/store-settings", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [settings] = await db
    .select()
    .from(storeSettings)
    .where(eq(storeSettings.businessId, businessId))
    .limit(1);

  // Return defaults if no settings exist yet
  if (!settings) {
    return c.json({
      settings: {
        storeEnabled: false,
        paymentMethods: [],
        deliveryEnabled: false,
        deliveryFee: 0,
        deliveryZones: null,
        welcomeMessage: null,
        minOrderAmount: 0,
      },
    });
  }

  return c.json({
    settings: {
      storeEnabled: settings.storeEnabled,
      paymentMethods: settings.paymentMethods,
      deliveryEnabled: settings.deliveryEnabled,
      deliveryFee: Number(settings.deliveryFee),
      deliveryZones: settings.deliveryZones,
      welcomeMessage: settings.welcomeMessage,
      minOrderAmount: Number(settings.minOrderAmount),
    },
  });
});

/** PATCH /store-settings - Update store configuration (upsert). */
ordersRoutes.patch(
  "/store-settings",
  zValidator("json", updateStoreSettingsSchema),
  async (c) => {
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");
    const data = c.req.valid("json");

    // Build update object
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.storeEnabled !== undefined) updates.storeEnabled = data.storeEnabled;
    if (data.paymentMethods !== undefined)
      updates.paymentMethods = data.paymentMethods;
    if (data.deliveryEnabled !== undefined)
      updates.deliveryEnabled = data.deliveryEnabled;
    if (data.deliveryFee !== undefined)
      updates.deliveryFee = String(data.deliveryFee);
    if (data.deliveryZones !== undefined)
      updates.deliveryZones = data.deliveryZones;
    if (data.welcomeMessage !== undefined)
      updates.welcomeMessage = data.welcomeMessage;
    if (data.minOrderAmount !== undefined)
      updates.minOrderAmount = String(data.minOrderAmount);

    // Upsert: create if not exists, update if exists
    const [existing] = await db
      .select({ id: storeSettings.id })
      .from(storeSettings)
      .where(eq(storeSettings.businessId, businessId))
      .limit(1);

    if (existing) {
      await db
        .update(storeSettings)
        .set(updates)
        .where(eq(storeSettings.businessId, businessId));
    } else {
      await db.insert(storeSettings).values({
        businessId,
        ...updates,
      });
    }

    logActivity({
      db,
      businessId,
      userId: user.id,
      action: "store_settings_updated",
      detail: "Configuracion de tienda actualizada",
    });

    // Return updated settings
    const [settings] = await db
      .select()
      .from(storeSettings)
      .where(eq(storeSettings.businessId, businessId))
      .limit(1);

    return c.json({
      settings: {
        storeEnabled: settings.storeEnabled,
        paymentMethods: settings.paymentMethods,
        deliveryEnabled: settings.deliveryEnabled,
        deliveryFee: Number(settings.deliveryFee),
        deliveryZones: settings.deliveryZones,
        welcomeMessage: settings.welcomeMessage,
        minOrderAmount: Number(settings.minOrderAmount),
      },
    });
  },
);

// ============================================================
// Auto-cancel stale orders
// ============================================================

/**
 * POST /orders/auto-cancel - Cancel pending orders older than 24h.
 *
 * Can be called manually or by a cron job (e.g., Coolify scheduled task).
 * Only cancels orders for the authenticated user's business.
 */
ordersRoutes.post("/orders/auto-cancel", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const cancelledCount = await cancelStaleOrdersForBusiness(db, businessId);

  if (cancelledCount > 0) {
    const user = c.get("user");
    logActivity({
      db,
      businessId,
      userId: user.id,
      action: "orders_auto_cancelled",
      detail: `${cancelledCount} pedido(s) cancelado(s) por inactividad (>24h)`,
    });
  }

  return c.json({ cancelled: cancelledCount });
});

export { ordersRoutes };
