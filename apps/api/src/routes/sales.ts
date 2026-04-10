/**
 * Sales API routes.
 *
 * POST   /sales              - Create a new sale
 * GET    /sales              - List sales (with filters, pagination)
 * GET    /sales/:id          - Get sale detail with items and payments
 * POST   /sales/:id/void     - Void a sale (requires owner PIN)
 *
 * GET    /exchange-rate       - Get current BCV exchange rate
 *
 * POST   /quotations         - Create a quotation
 * GET    /quotations          - List quotations
 * POST   /quotations/:id/convert - Convert quotation to sale
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createSaleSchema,
  voidSaleSchema,
  createQuotationSchema,
  calculateSaleTotal,
  calculateLineTotal,
} from "@nova/shared";
import { getCurrentRate } from "../services/exchange-rate";
import type { AppEnv } from "../types";

const salesRoutes = new Hono<AppEnv>();

// ============================================================
// Exchange Rate
// ============================================================

/** GET /exchange-rate - Get current BCV exchange rate. */
salesRoutes.get("/exchange-rate", async (c) => {
  const rate = await getCurrentRate();
  return c.json(rate);
});

// ============================================================
// Sales
// ============================================================

/** Query params for listing sales. */
const listSalesQuery = z.object({
  date: z.string().optional(),
  userId: z.string().uuid().optional(),
  method: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /sales - List sales with filters. */
salesRoutes.get("/sales", zValidator("query", listSalesQuery), async (c) => {
  // TODO: Query sales from DB with filters
  return c.json({
    sales: [],
    total: 0,
    page: 1,
    limit: 50,
  });
});

/** GET /sales/:id - Get sale detail. */
salesRoutes.get("/sales/:id", async (c) => {
  // TODO: Query sale + items + payments from DB using c.req.param("id")
  return c.json({ error: "Not connected to database" }, 503);
});

/**
 * POST /sales - Create a new sale.
 *
 * Flow:
 * 1. Validate items and payments
 * 2. Calculate totals (USD and Bs.)
 * 3. Insert sale, items, payments in a transaction
 * 4. Decrement product stock
 * 5. If fiado: create accounts_receivable entry
 * 6. Log activity
 */
salesRoutes.post("/sales", zValidator("json", createSaleSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  const rate = await getCurrentRate();

  // Calculate totals
  const itemsWithTotals = data.items.map((item) => ({
    ...item,
    lineTotal: calculateLineTotal(
      item.quantity,
      item.unitPrice,
      item.discountPercent,
    ),
  }));

  const totalUsd = calculateSaleTotal(data.items, data.discountPercent);
  const totalBs = Math.round(totalUsd * rate.rateBcv * 100) / 100;

  // TODO: When DB is connected:
  // 1. Begin transaction
  // 2. Insert sale record
  // 3. Insert sale_items
  // 4. Insert sale_payments
  // 5. Decrement product stock for each item
  // 6. If payment method is "fiado", create accounts_receivable
  // 7. Log activity
  // 8. Commit transaction

  return c.json({
    message: "Sale created (placeholder - DB not connected)",
    sale: {
      userId: user.id,
      totalUsd,
      totalBs,
      exchangeRate: rate.rateBcv,
      items: itemsWithTotals,
      payments: data.payments,
    },
  });
});

/**
 * POST /sales/:id/void - Void a sale.
 *
 * Requires owner PIN verification (handled by frontend modal).
 * Restores inventory and marks sale as voided.
 */
salesRoutes.post(
  "/sales/:id/void",
  zValidator("json", voidSaleSchema),
  async (c) => {
    // TODO: Void sale, restore inventory, log activity
    // const saleId = c.req.param("id");
    // const { reason } = c.req.valid("json");

    return c.json({ error: "Not connected to database" }, 503);
  },
);

// ============================================================
// Quotations
// ============================================================

/** GET /quotations - List quotations. */
salesRoutes.get("/quotations", async (c) => {
  // TODO: Query quotations from DB
  return c.json({ quotations: [] });
});

/** POST /quotations - Create a quotation. */
salesRoutes.post(
  "/quotations",
  zValidator("json", createQuotationSchema),
  async (c) => {
    // TODO: Insert quotation into DB
    return c.json({ error: "Not connected to database" }, 503);
  },
);

/** POST /quotations/:id/convert - Convert quotation to sale. */
salesRoutes.post("/quotations/:id/convert", async (c) => {
  // TODO: Convert quotation to sale using c.req.param("id")
  return c.json({ error: "Not connected to database" }, 503);
});

export { salesRoutes };
