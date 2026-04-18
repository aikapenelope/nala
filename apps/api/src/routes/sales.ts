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
import { eq, and, sql, desc, gte, lte, inArray } from "drizzle-orm";
import {
  createSaleSchema,
  voidSaleSchema,
  createQuotationSchema,
  createCreditNoteSchema,
  calculateSaleTotal,
  calculateLineTotal,
  calculateLineTax,
  calculateIgtf,
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
  customers,
  stockMovements,
} from "@nova/db";
import { getCurrentRate, setCurrentRate } from "../services/exchange-rate";
import { fetchBcvRates } from "../services/bcv-rates";
import { handleDbError } from "../utils/db-errors";
import type { AppEnv } from "../types";

const salesRoutes = new Hono<AppEnv>();

// ============================================================
// Exchange Rate
// ============================================================

/** GET /exchange-rate - Get current BCV exchange rate. */
salesRoutes.get("/exchange-rate", async (c) => {
  const businessId = c.get("businessId");
  try {
    const rate = await getCurrentRate(businessId);
    return c.json(rate);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Exchange rate unavailable";
    return c.json({ error: message }, 503);
  }
});

/**
 * POST /exchange-rate - Set exchange rate (owner only).
 *
 * The owner enters the BCV rate they see on bcv.org.ve.
 * Supports USD and EUR. Stores in DB (history) and Redis (cache).
 */
const setRateSchema = z.object({
  rateBcv: z.number().positive("La tasa del dolar debe ser mayor a 0"),
  rateEur: z
    .number()
    .positive("La tasa del euro debe ser mayor a 0")
    .optional(),
});

salesRoutes.post(
  "/exchange-rate",
  zValidator("json", setRateSchema),
  async (c) => {
    const user = c.get("user");

    // Only owners can set the exchange rate
    if (user.role !== "owner") {
      return c.json({ error: "Solo el dueno puede cambiar la tasa" }, 403);
    }

    const { rateBcv, rateEur } = c.req.valid("json");

    try {
      const rate = await setCurrentRate(user.businessId, rateBcv, rateEur);
      return c.json(rate);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Error guardando tasa";
      return c.json({ error: message }, 400);
    }
  },
);

/**
 * GET /exchange-rate/bcv - Fetch current BCV official rate.
 *
 * Returns the official BCV rate scraped from bcv.org.ve.
 * This is informational -- the business's actual rate is set manually.
 * Returns 503 if the BCV API is unreachable.
 */
salesRoutes.get("/exchange-rate/bcv", async (c) => {
  const rates = await fetchBcvRates();
  if (!rates) {
    return c.json(
      { error: "No se pudo obtener la tasa BCV. Intenta mas tarde." },
      503,
    );
  }
  return c.json({
    rateBcv: rates.usd,
    rateEur: rates.eur,
    date: rates.date,
    source: "bcv",
  });
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
  const { date, userId, method, page, limit } = c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const offset = (page - 1) * limit;

  const conditions = [eq(sales.businessId, businessId)];

  if (userId) {
    conditions.push(eq(sales.userId, userId));
  }

  if (date) {
    // Use UTC boundaries to avoid timezone issues.
    // The date string is expected as YYYY-MM-DD.
    const dayStart = new Date(`${date}T00:00:00.000Z`);
    const dayEnd = new Date(`${date}T23:59:59.999Z`);
    if (isNaN(dayStart.getTime())) {
      return c.json({ error: "Invalid date format. Use YYYY-MM-DD." }, 400);
    }
    conditions.push(gte(sales.createdAt, dayStart));
    conditions.push(lte(sales.createdAt, dayEnd));
  }

  // Filter by payment method requires a subquery on sale_payments
  if (method) {
    conditions.push(
      sql`${sales.id} IN (
        SELECT ${salePayments.saleId} FROM ${salePayments}
        WHERE ${salePayments.method} = ${method}
      )`,
    );
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
 * Validates before inserting:
 * - Exchange rate is available
 * - All products exist and are active
 * - Sufficient stock for each item
 * - Payments cover the sale total
 * - Fiado requires a customer
 *
 * Atomic transaction:
 * 1. Insert sale, items, payments
 * 2. Decrement product stock
 * 3. If fiado: create accounts_receivable + update customer balance
 * 4. Generate accounting entries
 * 5. Log activity
 */
salesRoutes.post("/sales", zValidator("json", createSaleSchema), async (c) => {
  const data = c.req.valid("json");
  const user = c.get("user");
  const db = c.get("db");
  const businessId = c.get("businessId");

  // 1. Get exchange rate (fail early if unavailable)
  let rate;
  try {
    rate = await getCurrentRate(businessId);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Exchange rate unavailable";
    return c.json({ error: `Cannot create sale: ${message}` }, 503);
  }

  // 2. Validate fiado requires customer
  const hasFiado = data.payments.some((p) => p.method === "fiado");
  if (hasFiado && !data.customerId) {
    return c.json(
      { error: "Fiado payment requires a customer (customerId)" },
      400,
    );
  }

  // 3. Validate customer exists if provided + credit limit for fiado
  if (data.customerId) {
    const [customer] = await db
      .select({
        id: customers.id,
        balanceUsd: customers.balanceUsd,
        creditLimitUsd: customers.creditLimitUsd,
      })
      .from(customers)
      .where(
        and(
          eq(customers.id, data.customerId),
          eq(customers.businessId, businessId),
          eq(customers.isActive, true),
        ),
      )
      .limit(1);

    if (!customer) {
      return c.json({ error: "Customer not found" }, 400);
    }

    // Check credit limit for fiado payments
    if (hasFiado) {
      const creditLimit = Number(customer.creditLimitUsd);
      if (creditLimit > 0) {
        const currentBalance = Number(customer.balanceUsd);
        const fiadoAmount = data.payments
          .filter((p) => p.method === "fiado")
          .reduce((sum, p) => sum + p.amountUsd, 0);

        if (currentBalance + fiadoAmount > creditLimit) {
          return c.json(
            {
              error: `El cliente excede su cupo de credito. Limite: $${creditLimit.toFixed(2)}, saldo actual: $${currentBalance.toFixed(2)}, fiado solicitado: $${fiadoAmount.toFixed(2)}`,
            },
            400,
          );
        }
      }
    }
  }

  // 4. Validate all products exist, are active, and have sufficient stock
  const productIds = [...new Set(data.items.map((i) => i.productId))];
  const dbProducts = await db
    .select()
    .from(products)
    .where(
      and(
        inArray(products.id, productIds),
        eq(products.businessId, businessId),
      ),
    );

  const productMap = new Map(dbProducts.map((p) => [p.id, p]));

  for (const item of data.items) {
    const product = productMap.get(item.productId);
    if (!product) {
      return c.json({ error: `Product ${item.productId} not found` }, 400);
    }
    if (!product.isActive) {
      return c.json(
        { error: `Product "${product.name}" is no longer available` },
        400,
      );
    }

    // Check stock (aggregate quantity per product across all items)
    const totalQtyForProduct = data.items
      .filter((i) => i.productId === item.productId)
      .reduce((sum, i) => sum + i.quantity, 0);

    if (product.stock < totalQtyForProduct) {
      return c.json(
        {
          error: `Insufficient stock for "${product.name}": available ${product.stock}, requested ${totalQtyForProduct}`,
        },
        400,
      );
    }
  }

  // 5. Validate variant stock if applicable
  const variantIds = data.items
    .map((i) => i.variantId)
    .filter((id): id is string => id !== undefined);

  if (variantIds.length > 0) {
    const dbVariants = await db
      .select()
      .from(productVariants)
      .where(inArray(productVariants.id, variantIds));

    const variantMap = new Map(dbVariants.map((v) => [v.id, v]));

    for (const item of data.items) {
      if (!item.variantId) continue;
      const variant = variantMap.get(item.variantId);
      if (!variant || !variant.isActive) {
        return c.json({ error: `Variant ${item.variantId} not found` }, 400);
      }
      if (variant.stock < item.quantity) {
        return c.json(
          {
            error: `Insufficient stock for variant ${item.variantId}: available ${variant.stock}, requested ${item.quantity}`,
          },
          400,
        );
      }
    }
  }

  // 6. Calculate totals with IVA
  const itemsWithTotals = data.items.map((item) => {
    const product = productMap.get(item.productId);
    const taxRate = item.taxRate ?? Number(product?.taxRate ?? 0);
    const lineTotal = calculateLineTotal(
      item.quantity,
      item.unitPrice,
      item.discountPercent,
    );
    const taxAmount = calculateLineTax(lineTotal, taxRate);
    return { ...item, lineTotal, taxRate, taxAmount };
  });

  const saleTotals = calculateSaleTotal(
    itemsWithTotals,
    data.discountPercent,
    data.discountAmount,
  );
  const totalUsd = saleTotals.total;
  const totalPayments = data.payments.reduce((sum, p) => sum + p.amountUsd, 0);

  // Allow a small tolerance for floating point rounding (1 cent)
  if (totalPayments < totalUsd - 0.01) {
    return c.json(
      {
        error: `Payments ($${totalPayments.toFixed(2)}) do not cover sale total ($${totalUsd.toFixed(2)})`,
      },
      400,
    );
  }

  const totalBs = Math.round(totalUsd * rate.rateBcv * 100) / 100;

  // Calculate IGTF on foreign currency payments
  const igtfAmount = calculateIgtf(data.payments);

  // Atomic transaction
  let result;
  try {
    result = await db.transaction(async (tx) => {
    // Get next control number for this business
    const [maxControl] = await tx
      .select({
        max: sql<number>`COALESCE(MAX(${sales.controlNumber}), 0)`,
      })
      .from(sales)
      .where(eq(sales.businessId, businessId));
    const controlNumber = (maxControl?.max ?? 0) + 1;

    // Insert sale record
    const [sale] = await tx
      .insert(sales)
      .values({
        businessId,
        userId: user.id,
        customerId: data.customerId,
        subtotalUsd: String(saleTotals.subtotal),
        totalUsd: String(totalUsd),
        totalBs: String(totalBs),
        exchangeRate: String(rate.rateBcv),
        discountPercent: String(data.discountPercent),
        discountAmount: String(data.discountAmount),
        taxAmount: String(saleTotals.taxTotal),
        igtfAmount: String(igtfAmount),
        controlNumber,
        notes: data.notes,
        status: "completed",
        documentType: "invoice",
      })
      .returning();

    // Insert sale items
    await tx.insert(saleItems).values(
      itemsWithTotals.map((item) => ({
        saleId: sale.id,
        businessId,
        productId: item.productId,
        variantId: item.variantId,
        quantity: item.quantity,
        unitPrice: String(item.unitPrice),
        discountPercent: String(item.discountPercent),
        lineTotal: String(item.lineTotal),
        taxRate: String(item.taxRate),
        taxAmount: String(item.taxAmount),
      })),
    );

    // Insert sale payments
    await tx.insert(salePayments).values(
      data.payments.map((payment) => ({
        saleId: sale.id,
        businessId,
        method: payment.method,
        amountUsd: String(payment.amountUsd),
        amountBs: payment.amountBs ? String(payment.amountBs) : null,
        exchangeRate: payment.exchangeRate
          ? String(payment.exchangeRate)
          : String(rate.rateBcv),
        reference: payment.reference,
      })),
    );

    // Decrement product stock for each item
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

      // Log stock movement
      await tx.insert(stockMovements).values({
        businessId,
        productId: item.productId,
        variantId: item.variantId,
        type: "sale",
        quantity: -item.quantity,
        costUnit: String(productMap.get(item.productId)?.cost ?? 0),
        referenceType: "sale",
        referenceId: sale.id,
        userId: user.id,
      });
    }

    // If fiado payment, create accounts_receivable and update customer balance
    const fiadoPayment = data.payments.find((p) => p.method === "fiado");
    if (fiadoPayment && data.customerId) {
      await tx.insert(accountsReceivable).values({
        businessId,
        customerId: data.customerId,
        saleId: sale.id,
        amountUsd: String(fiadoPayment.amountUsd),
        balanceUsd: String(fiadoPayment.amountUsd),
      });

      // Update customer balance
      await tx
        .update(customers)
        .set({
          balanceUsd: sql`${customers.balanceUsd}::numeric + ${fiadoPayment.amountUsd}`,
          totalPurchases: sql`${customers.totalPurchases} + 1`,
          totalSpentUsd: sql`${customers.totalSpentUsd}::numeric + ${totalUsd}`,
          averageTicketUsd: sql`(${customers.totalSpentUsd}::numeric + ${totalUsd}) / (${customers.totalPurchases} + 1)`,
          lastPurchaseAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, data.customerId));
    } else if (data.customerId) {
      // Non-fiado sale with customer: update purchase stats only
      await tx
        .update(customers)
        .set({
          totalPurchases: sql`${customers.totalPurchases} + 1`,
          totalSpentUsd: sql`${customers.totalSpentUsd}::numeric + ${totalUsd}`,
          averageTicketUsd: sql`(${customers.totalSpentUsd}::numeric + ${totalUsd}) / (${customers.totalPurchases} + 1)`,
          lastPurchaseAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(customers.id, data.customerId));
    }

    // Generate accounting entries (revenue)
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

    // Log activity
    await tx.insert(activityLog).values({
      businessId,
      userId: user.id,
      action: "sale_created",
      detail: `Sale $${totalUsd} (${data.items.length} items)`,
    });

    return sale;
    });
  } catch (err) {
    const dbErr = handleDbError(err);
    if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
    throw err;
  }

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

    let result;
    try {
      result = await db.transaction(async (tx) => {
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
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }

    if (!result) {
      return c.json({ error: "Sale not found or already voided" }, 404);
    }

    return c.json({ sale: result });
  },
);

// ============================================================
// Credit Notes
// ============================================================

/**
 * POST /sales/credit-note - Create a credit note (partial refund).
 *
 * Creates a negative sale document linked to the original sale.
 * Restores stock for returned items. Adjusts customer balance if applicable.
 */
salesRoutes.post(
  "/sales/credit-note",
  zValidator("json", createCreditNoteSchema),
  async (c) => {
    const data = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const businessId = c.get("businessId");

    // Only owners can create credit notes
    if (user.role !== "owner") {
      return c.json(
        { error: "Solo el dueno puede crear notas de credito" },
        403,
      );
    }

    // Verify original sale exists and is completed
    const [originalSale] = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.id, data.originalSaleId),
          eq(sales.businessId, businessId),
          eq(sales.status, "completed"),
          eq(sales.documentType, "invoice"),
        ),
      )
      .limit(1);

    if (!originalSale) {
      return c.json(
        { error: "Venta original no encontrada o no es una factura completada" },
        404,
      );
    }

    // Calculate credit note totals
    const creditItems = data.items.map((item) => {
      const lineTotal = calculateLineTotal(item.quantity, item.unitPrice, 0);
      const taxAmount = calculateLineTax(lineTotal, item.taxRate);
      return { ...item, lineTotal, taxAmount, discountPercent: 0 };
    });

    const creditSubtotal = creditItems.reduce((sum, i) => sum + i.lineTotal, 0);
    const creditTax = creditItems.reduce((sum, i) => sum + i.taxAmount, 0);
    const creditTotal = Math.round((creditSubtotal + creditTax) * 100) / 100;

    let result;
    try {
      result = await db.transaction(async (tx) => {
        // Create credit note (negative sale)
        const [creditNote] = await tx
          .insert(sales)
          .values({
            businessId,
            userId: user.id,
            customerId: originalSale.customerId,
            subtotalUsd: String(-creditSubtotal),
            totalUsd: String(-creditTotal),
            totalBs: originalSale.exchangeRate
              ? String(-creditTotal * Number(originalSale.exchangeRate))
              : null,
            exchangeRate: originalSale.exchangeRate,
            taxAmount: String(-creditTax),
            notes: data.reason,
            status: "completed",
            documentType: "credit_note",
            originalSaleId: data.originalSaleId,
          })
          .returning();

        // Insert credit note items
        await tx.insert(saleItems).values(
          creditItems.map((item) => ({
            saleId: creditNote.id,
            businessId,
            productId: item.productId,
            variantId: item.variantId,
            quantity: -item.quantity,
            unitPrice: String(item.unitPrice),
            lineTotal: String(-item.lineTotal),
            taxRate: String(item.taxRate),
            taxAmount: String(-item.taxAmount),
          })),
        );

        // Restore stock for returned items
        for (const item of data.items) {
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

        // Adjust customer balance if applicable
        if (originalSale.customerId) {
          await tx
            .update(customers)
            .set({
              balanceUsd: sql`GREATEST(0, ${customers.balanceUsd}::numeric - ${creditTotal})`,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, originalSale.customerId));
        }

        // Log activity
        await tx.insert(activityLog).values({
          businessId,
          userId: user.id,
          action: "credit_note_created",
          detail: `Credit note $${creditTotal.toFixed(2)} for sale ${data.originalSaleId.slice(0, 8)}: ${data.reason}`,
        });

        return creditNote;
      });
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }

    return c.json({ creditNote: result }, 201);
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
