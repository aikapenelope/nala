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
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  createSaleSchema,
  voidSaleSchema,
  createQuotationSchema,
  calculateSaleTotal,
  calculateLineTotal,
} from "@nova/shared";
import {
  sales,
  saleItems,
  salePayments,
  products,
  productVariants,
  quotations,
  accountsReceivable,
  activityLog,
  accountingEntries,
  accountingAccounts,
} from "@nova/db";
import { getCurrentRate } from "../services/exchange-rate";
import type { AppEnv } from "../types";

const salesRoutes = new Hono<AppEnv>();

// ============================================================
// Exchange Rate
// ============================================================

/** GET /exchange-rate - Get current BCV exchange rate. */
salesRoutes.get("/exchange-rate", async (c) => {
  try {
    const rate = await getCurrentRate();
    return c.json(rate);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Exchange rate unavailable";
    return c.json({ error: message }, 503);
  }
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
  const { date, userId, page, limit } = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const offset = (page - 1) * limit;

  const conditions = [eq(sales.businessId, businessId)];

  if (userId) {
    conditions.push(eq(sales.userId, userId));
  }

  if (date) {
    const dayStart = new Date(date);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setHours(23, 59, 59, 999);
    conditions.push(gte(sales.createdAt, dayStart));
    conditions.push(lte(sales.createdAt, dayEnd));
  }

  const rows = await db
    .select()
    .from(sales)
    .where(and(...conditions))
    .orderBy(desc(sales.createdAt))
    .limit(limit)
    .offset(offset);

  const [countResult] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(sales)
    .where(and(...conditions));

  return c.json({
    sales: rows,
    total: countResult?.count ?? 0,
    page,
    limit,
  });
});

/** GET /sales/:id - Get sale detail. */
salesRoutes.get("/sales/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.businessId, businessId)))
    .limit(1);

  if (!sale) {
    return c.json({ error: "Sale not found" }, 404);
  }

  const items = await db
    .select()
    .from(saleItems)
    .where(eq(saleItems.saleId, id));

  const payments = await db
    .select()
    .from(salePayments)
    .where(eq(salePayments.saleId, id));

  return c.json({ sale, items, payments });
});

/**
 * POST /sales - Create a new sale.
 *
 * Atomic transaction:
 * 1. Validate items and payments
 * 2. Calculate totals (USD and Bs.)
 * 3. Insert sale, items, payments
 * 4. Decrement product stock
 * 5. If fiado: create accounts_receivable entry
 * 6. Generate accounting entries
 * 7. Log activity
 */
salesRoutes.post("/sales", zValidator("json", createSaleSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  const db = c.get("db");
  const businessId = c.get("businessId");
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

  // Atomic transaction
  const result = await db.transaction(async (tx) => {
    // 1. Insert sale record
    const [sale] = await tx
      .insert(sales)
      .values({
        businessId,
        userId: user.id,
        customerId: data.customerId,
        totalUsd: String(totalUsd),
        totalBs: String(totalBs),
        exchangeRate: String(rate.rateBcv),
        discountPercent: String(data.discountPercent),
        notes: data.notes,
        status: "completed",
      })
      .returning();

    // 2. Insert sale items
    await tx.insert(saleItems).values(
      itemsWithTotals.map((item) => ({
        saleId: sale.id,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        discountPercent: String(item.discountPercent),
        lineTotal: String(item.lineTotal),
      })),
    );

    // 3. Insert sale payments
    await tx.insert(salePayments).values(
      data.payments.map((payment) => ({
        saleId: sale.id,
        method: payment.method,
        amountUsd: String(payment.amountUsd),
        amountBs: payment.amountBs ? String(payment.amountBs) : null,
        exchangeRate: payment.exchangeRate
          ? String(payment.exchangeRate)
          : String(rate.rateBcv),
        reference: payment.reference,
      })),
    );

    // 4. Decrement product stock for each item
    for (const item of data.items) {
      if (item.variantId) {
        await tx
          .update(productVariants)
          .set({
            stock: sql`${productVariants.stock} - ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(productVariants.id, item.variantId));
      }

      await tx
        .update(products)
        .set({
          stock: sql`${products.stock} - ${item.quantity}`,
          lastSoldAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(products.id, item.productId));
    }

    // 5. If fiado payment, create accounts_receivable
    const fiadoPayment = data.payments.find((p) => p.method === "fiado");
    if (fiadoPayment && data.customerId) {
      await tx.insert(accountsReceivable).values({
        businessId,
        customerId: data.customerId,
        saleId: sale.id,
        amountUsd: String(fiadoPayment.amountUsd),
        balanceUsd: String(fiadoPayment.amountUsd),
      });
    }

    // 6. Generate accounting entries (revenue)
    // Find the sales revenue account and cash/bank account
    const revenueAccounts = await tx
      .select()
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.businessId, businessId),
          eq(accountingAccounts.code, "4101"),
        ),
      )
      .limit(1);

    const cashAccounts = await tx
      .select()
      .from(accountingAccounts)
      .where(
        and(
          eq(accountingAccounts.businessId, businessId),
          eq(accountingAccounts.code, "1101"),
        ),
      )
      .limit(1);

    if (revenueAccounts[0] && cashAccounts[0]) {
      await tx.insert(accountingEntries).values({
        businessId,
        date: new Date(),
        debitAccountId: cashAccounts[0].id,
        creditAccountId: revenueAccounts[0].id,
        amount: String(totalUsd),
        description: `Venta #${sale.id.slice(0, 8)}`,
        referenceType: "sale",
        referenceId: sale.id,
      });
    }

    // 7. Log activity
    await tx.insert(activityLog).values({
      businessId,
      userId: user.id,
      action: "sale_created",
      detail: `Sale $${totalUsd} (${data.items.length} items)`,
    });

    return sale;
  });

  return c.json({ sale: result }, 201);
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
    const saleId = c.req.param("id");
    const { reason } = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const result = await db.transaction(async (tx) => {
      // Get the sale
      const [sale] = await tx
        .select()
        .from(sales)
        .where(
          and(
            eq(sales.id, saleId),
            eq(sales.businessId, businessId),
            eq(sales.status, "completed"),
          ),
        )
        .limit(1);

      if (!sale) {
        return null;
      }

      // Get sale items to restore stock
      const items = await tx
        .select()
        .from(saleItems)
        .where(eq(saleItems.saleId, saleId));

      // Restore stock for each item
      for (const item of items) {
        if (item.variantId) {
          await tx
            .update(productVariants)
            .set({
              stock: sql`${productVariants.stock} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(productVariants.id, item.variantId));
        }

        await tx
          .update(products)
          .set({
            stock: sql`${products.stock} + ${item.quantity}`,
            updatedAt: new Date(),
          })
          .where(eq(products.id, item.productId));
      }

      // Mark sale as voided
      const [voided] = await tx
        .update(sales)
        .set({
          status: "voided",
          voidReason: reason,
          voidedBy: user.id,
          updatedAt: new Date(),
        })
        .where(eq(sales.id, saleId))
        .returning();

      // Log activity
      await tx.insert(activityLog).values({
        businessId,
        userId: user.id,
        action: "sale_voided",
        detail: `Sale ${saleId.slice(0, 8)} voided: ${reason}`,
      });

      return voided;
    });

    if (!result) {
      return c.json({ error: "Sale not found or already voided" }, 404);
    }

    return c.json({ sale: result });
  },
);

// ============================================================
// Quotations
// ============================================================

/** GET /quotations - List quotations. */
salesRoutes.get("/quotations", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const rows = await db
    .select()
    .from(quotations)
    .where(eq(quotations.businessId, businessId))
    .orderBy(desc(quotations.createdAt));

  return c.json({ quotations: rows });
});

/** POST /quotations - Create a quotation. */
salesRoutes.post(
  "/quotations",
  zValidator("json", createQuotationSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const totalUsd = calculateSaleTotal(
      data.items.map((i) => ({
        quantity: i.quantity,
        unitPrice: i.unitPrice,
        discountPercent: i.discountPercent,
      })),
    );

    const [quotation] = await db
      .insert(quotations)
      .values({
        businessId,
        userId: user.id,
        customerId: data.customerId,
        totalUsd: String(totalUsd),
        items: data.items,
        status: "draft",
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
      })
      .returning();

    return c.json({ quotation }, 201);
  },
);

/** POST /quotations/:id/convert - Convert quotation to sale. */
salesRoutes.post("/quotations/:id/convert", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [quotation] = await db
    .select()
    .from(quotations)
    .where(
      and(
        eq(quotations.id, id),
        eq(quotations.businessId, businessId),
        eq(quotations.status, "draft"),
      ),
    )
    .limit(1);

  if (!quotation) {
    return c.json({ error: "Quotation not found or already converted" }, 404);
  }

  // Mark quotation as converted (actual sale creation is done via POST /sales)
  await db
    .update(quotations)
    .set({ status: "converted", updatedAt: new Date() })
    .where(eq(quotations.id, id));

  return c.json({
    message: "Quotation marked for conversion",
    quotation: { ...quotation, status: "converted" },
    items: quotation.items,
  });
});

export { salesRoutes };
