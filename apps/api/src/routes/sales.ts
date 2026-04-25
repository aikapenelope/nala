/**
 * Sales API routes.
 *
 * POST   /sales                    - Create a new sale
 * GET    /sales                    - List sales (with filters, pagination)
 * GET    /sales/:id                - Get sale detail with items and payments
 * POST   /sales/:id/void           - Void a sale (owner only)
 *
 * GET    /exchange-rate             - Get current BCV exchange rate
 * POST   /exchange-rate             - Set exchange rate (owner only)
 * GET    /exchange-rate/bcv         - Fetch official BCV rate
 *
 * POST   /quotations               - Create a quotation
 * GET    /quotations                - List quotations
 * POST   /quotations/:id/convert   - Convert quotation to sale
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, desc, gte, lte, inArray } from "drizzle-orm";
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
  customers,
  users,
  stockMovements,
} from "@nova/db";
import { getCurrentRate, setCurrentRate } from "../services/exchange-rate";
import { fetchBcvRates } from "../services/bcv-rates";
import { generateReceiptPdf } from "../services/pdf-generator";
import { handleDbError } from "../utils/db-errors";
import { validateUuidParam } from "../middleware/validate-uuid";
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

  const promedio =
    rates.usd > 0 && rates.usdParalelo > 0
      ? Math.round(((rates.usd + rates.usdParalelo) / 2) * 100) / 100
      : rates.usd;

  return c.json({
    rateBcv: rates.usd,
    rateEur: rates.eur,
    rateParalelo: rates.usdParalelo,
    ratePromedio: promedio,
    date: rates.date,
    source: "api",
  });
});

// ============================================================
// Sales
// ============================================================

/** Query params for listing sales. */
const listSalesQuery = z.object({
  date: z.string().optional(),
  userId: z.string().uuid().optional(),
  customerId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  method: z.string().optional(),
  channel: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /sales - List sales with filters. */
salesRoutes.get("/sales", zValidator("query", listSalesQuery), async (c) => {
  const { date, userId, customerId, productId, method, channel, page, limit } =
    c.req.valid("query");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const offset = (page - 1) * limit;

  const conditions = [eq(sales.businessId, businessId)];

  if (userId) {
    conditions.push(eq(sales.userId, userId));
  }

  if (customerId) {
    conditions.push(eq(sales.customerId, customerId));
  }

  if (channel) {
    conditions.push(eq(sales.channel, channel));
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

  // Filter by product requires a subquery on sale_items
  if (productId) {
    conditions.push(
      sql`${sales.id} IN (
        SELECT ${saleItems.saleId} FROM ${saleItems}
        WHERE ${saleItems.productId} = ${productId}
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
salesRoutes.get("/sales/:id", validateUuidParam, async (c) => {
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
 * GET /sales/:id/receipt - Download a PDF receipt for a sale.
 */
salesRoutes.get("/sales/:id/receipt", validateUuidParam, async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");
  const user = c.get("user");

  const [sale] = await db
    .select()
    .from(sales)
    .where(and(eq(sales.id, id), eq(sales.businessId, businessId)))
    .limit(1);

  if (!sale) {
    return c.json({ error: "Sale not found" }, 404);
  }

  // Get items with product names
  const items = await db
    .select({
      name: products.name,
      quantity: saleItems.quantity,
      unitPrice: saleItems.unitPrice,
      lineTotal: saleItems.lineTotal,
    })
    .from(saleItems)
    .innerJoin(products, eq(saleItems.productId, products.id))
    .where(eq(saleItems.saleId, id));

  const payments = await db
    .select()
    .from(salePayments)
    .where(eq(salePayments.saleId, id));

  // Get customer name if present
  let customerName: string | null = null;
  if (sale.customerId) {
    const [customer] = await db
      .select({ name: customers.name })
      .from(customers)
      .where(eq(customers.id, sale.customerId))
      .limit(1);
    customerName = customer?.name ?? null;
  }

  // Get seller name
  const [seller] = await db
    .select({ name: users.name })
    .from(users)
    .where(eq(users.id, sale.userId))
    .limit(1);

  const pdfBuffer = await generateReceiptPdf({
    saleId: sale.id,
    businessName: user.businessName,
    sellerName: seller?.name ?? "Vendedor",
    customerName,
    createdAt: sale.createdAt.toISOString(),
    items: items.map((i) => ({
      name: i.name,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    })),
    payments: payments.map((p) => ({
      method: p.method,
      amountUsd: Number(p.amountUsd),
      amountBs: p.amountBs ? Number(p.amountBs) : null,
      reference: p.reference,
    })),
    totalUsd: Number(sale.totalUsd),
    totalBs: sale.totalBs ? Number(sale.totalBs) : null,
    exchangeRate: sale.exchangeRate ? Number(sale.exchangeRate) : null,
    discountPercent: Number(sale.discountPercent ?? 0),
    discountAmount: Number(sale.discountAmount ?? 0),
    notes: sale.notes,
    status: sale.status,
  });

  const shortId = sale.id.slice(0, 8);
  c.header("Content-Type", "application/pdf");
  c.header("Content-Disposition", `attachment; filename="recibo-${shortId}.pdf"`);
  return c.body(pdfBuffer);
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

    // Stock is validated atomically inside the transaction (WHERE stock >= qty)
    // to prevent race conditions between concurrent sales.
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
      // Variant stock is validated atomically inside the transaction.
    }
  }

  // 6. Calculate totals (including surcharges)
  const itemsWithTotals = data.items.map((item) => {
    const lineTotal = calculateLineTotal(
      item.quantity,
      item.unitPrice,
      item.discountPercent,
    );
    return { ...item, lineTotal };
  });

  const totalUsd = calculateSaleTotal(
    data.items,
    data.discountPercent,
    data.discountAmount,
    data.surcharges,
  );

  // Calculate total cost for profit tracking
  const totalCostUsd = data.items.reduce((sum, item) => {
    const product = productMap.get(item.productId);
    return sum + item.quantity * Number(product?.cost ?? 0);
  }, 0);

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

  // Atomic transaction
  let result;
  try {
    result = await db.transaction(async (tx) => {
      // Insert sale record
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
          discountAmount: String(data.discountAmount),
          totalCostUsd: String(Math.round(totalCostUsd * 100) / 100),
          channel: data.channel,
          surcharges: data.surcharges,
          notes: data.notes,
          status: "completed",
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

      // Decrement product stock atomically with WHERE stock >= qty guard.
      // This prevents overselling under concurrent requests (race condition fix).
      // Track post-decrement stock for qty_after_transaction in movement log.
      const stockAfterMap = new Map<string, number>();
      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (product?.isService) continue;

        if (item.variantId) {
          const variantResult = await tx
            .update(productVariants)
            .set({
              stock: sql`${productVariants.stock} - ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(
              and(
                eq(productVariants.id, item.variantId),
                sql`${productVariants.stock} >= ${item.quantity}`,
              ),
            )
            .returning({ id: productVariants.id });

          if (variantResult.length === 0) {
            throw new Error(`Insufficient stock for variant ${item.variantId}`);
          }
        }

        const productResult = await tx
          .update(products)
          .set({
            stock: sql`${products.stock} - ${item.quantity}`,
            lastSoldAt: new Date(),
            updatedAt: new Date(),
          })
          .where(
            and(
              eq(products.id, item.productId),
              sql`${products.stock} >= ${item.quantity}`,
            ),
          )
          .returning({ id: products.id, stock: products.stock });

        if (productResult.length === 0) {
          throw new Error(
            `Insufficient stock for "${product?.name ?? item.productId}"`,
          );
        }

        // Store the post-decrement stock for the movement log
        stockAfterMap.set(item.productId, productResult[0].stock);
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

      // Log stock movements inside the transaction for consistency.
      for (const item of data.items) {
        const product = productMap.get(item.productId);
        if (product?.isService) continue;

        await tx.insert(stockMovements).values({
          businessId,
          productId: item.productId,
          variantId: item.variantId,
          type: "sale",
          quantity: -item.quantity,
          costUnit: String(product?.cost ?? 0),
          referenceType: "sale",
          referenceId: sale.id,
          userId: user.id,
          qtyAfterTransaction: stockAfterMap.get(item.productId) ?? null,
        });
      }

      return sale;
    });
  } catch (err) {
    // Stock guard throws a plain Error with "Insufficient stock" message.
    // Return 409 Conflict so the client can retry or show a stock error.
    if (err instanceof Error && err.message.startsWith("Insufficient stock")) {
      return c.json({ error: err.message }, 409);
    }
    const dbErr = handleDbError(err);
    if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
    throw err;
  }

  return c.json({ sale: result }, 201);
});

/**
 * POST /sales/:id/void - Void a sale.
 *
 * Requires owner role (enforced by role check in the handler).
 * Restores inventory, reverses fiado (customer balance + accounts_receivable),
 * reverses customer purchase stats, and marks sale as voided.
 */
salesRoutes.post(
  "/sales/:id/void",
  validateUuidParam,
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

        // Restore stock for each item and log movements
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

          const [restored] = await tx
            .update(products)
            .set({
              stock: sql`${products.stock} + ${item.quantity}`,
              updatedAt: new Date(),
            })
            .where(eq(products.id, item.productId))
            .returning({ stock: products.stock });

          await tx.insert(stockMovements).values({
            businessId,
            productId: item.productId,
            variantId: item.variantId,
            type: "void",
            quantity: item.quantity,
            costUnit: String(item.unitPrice),
            referenceType: "sale",
            referenceId: saleId,
            userId: user.id,
            qtyAfterTransaction: restored?.stock ?? null,
          });
        }

        // Reverse fiado: restore customer balance and cancel accounts_receivable
        if (sale.customerId) {
          const fiadoPayments = await tx
            .select()
            .from(salePayments)
            .where(
              and(
                eq(salePayments.saleId, saleId),
                eq(salePayments.method, "fiado"),
              ),
            );

          const fiadoTotal = fiadoPayments.reduce(
            (sum, p) => sum + Number(p.amountUsd),
            0,
          );

          if (fiadoTotal > 0) {
            // Subtract fiado amount from customer balance
            await tx
              .update(customers)
              .set({
                balanceUsd: sql`GREATEST(${customers.balanceUsd}::numeric - ${fiadoTotal}, 0)`,
                updatedAt: new Date(),
              })
              .where(eq(customers.id, sale.customerId));

            // Cancel the accounts_receivable record for this sale
            await tx
              .update(accountsReceivable)
              .set({
                status: "cancelled",
                updatedAt: new Date(),
              })
              .where(
                and(
                  eq(accountsReceivable.saleId, saleId),
                  eq(accountsReceivable.businessId, businessId),
                ),
              );
          }

          // Reverse customer purchase stats
          const saleTotal = Number(sale.totalUsd);
          await tx
            .update(customers)
            .set({
              totalPurchases: sql`GREATEST(${customers.totalPurchases} - 1, 0)`,
              totalSpentUsd: sql`GREATEST(${customers.totalSpentUsd}::numeric - ${saleTotal}, 0)`,
              averageTicketUsd: sql`CASE WHEN ${customers.totalPurchases} > 1
              THEN (${customers.totalSpentUsd}::numeric - ${saleTotal}) / (${customers.totalPurchases} - 1)
              ELSE 0 END`,
              updatedAt: new Date(),
            })
            .where(eq(customers.id, sale.customerId));
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
    .orderBy(desc(quotations.createdAt))
    .limit(500);

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
salesRoutes.post("/quotations/:id/convert", validateUuidParam, async (c) => {
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
