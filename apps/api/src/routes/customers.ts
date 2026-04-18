/**
 * Customer and accounts API routes.
 *
 * GET    /customers          - List customers (search, pagination)
 * GET    /customers/:id      - Get customer detail with receivables
 * POST   /customers          - Create customer
 * PATCH  /customers/:id      - Update customer
 *
 * GET    /accounts/receivable              - List pending receivables
 * POST   /accounts/receivable/:id/payment  - Record payment on receivable
 * POST   /accounts/receivable/collect-all  - Generate WhatsApp collection links
 *
 * GET    /accounts/payable                 - List pending payables
 * POST   /accounts/payable                 - Create payable
 * PATCH  /accounts/payable/:id/pay         - Record payment on payable
 *
 * POST   /day-close           - Record end-of-day cash reconciliation
 * GET    /day-close/history   - List past day closes
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, desc, gte, lte, ilike } from "drizzle-orm";
import {
  createCustomerSchema,
  updateCustomerSchema,
  recordPaymentSchema,
  createAccountPayableSchema,
  dayCloseSchema,
  calculateCustomerSegments,
} from "@nova/shared";
import {
  customers,
  customerSegments,
  accountsReceivable,
  accountsPayable,
  dayCloses,
  cashOpenings,
  sales,
  salePayments,
  activityLog,
} from "@nova/db";
import { handleDbError } from "../utils/db-errors";
import type { AppEnv } from "../types";

const customersRoutes = new Hono<AppEnv>();

/** Escape LIKE/ILIKE special characters in user input. */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

const listCustomersQuery = z.object({
  search: z.string().optional(),
  segment: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/** GET /customers - List customers with search and pagination. */
customersRoutes.get(
  "/customers",
  zValidator("query", listCustomersQuery),
  async (c) => {
    const { search, page, limit } = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const offset = (page - 1) * limit;

    const conditions = [
      eq(customers.businessId, businessId),
      eq(customers.isActive, true),
    ];

    if (search) {
      conditions.push(ilike(customers.name, `%${escapeLike(search)}%`));
    }

    const rows = await db
      .select()
      .from(customers)
      .where(and(...conditions))
      .orderBy(desc(customers.updatedAt))
      .limit(limit)
      .offset(offset);

    const [countResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(customers)
      .where(and(...conditions));

    // Fetch segments for the returned customers
    const customerIds = rows.map((r) => r.id);
    let segmentMap: Record<string, string[]> = {};

    if (customerIds.length > 0) {
      const segmentRows = await db
        .select({
          customerId: customerSegments.customerId,
          segment: customerSegments.segment,
        })
        .from(customerSegments)
        .where(sql`${customerSegments.customerId} = ANY(${customerIds})`);

      segmentMap = segmentRows.reduce<Record<string, string[]>>((acc, row) => {
        if (!acc[row.customerId]) acc[row.customerId] = [];
        acc[row.customerId].push(row.segment);
        return acc;
      }, {});
    }

    const customersWithSegments = rows.map((r) => ({
      ...r,
      segments: segmentMap[r.id] ?? [],
    }));

    return c.json({
      customers: customersWithSegments,
      total: countResult?.count ?? 0,
      page,
      limit,
    });
  },
);

/** GET /customers/:id - Get customer detail. */
customersRoutes.get("/customers/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [customer] = await db
    .select()
    .from(customers)
    .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
    .limit(1);

  if (!customer) {
    return c.json({ error: "Customer not found" }, 404);
  }

  // Get open receivables for this customer
  const receivables = await db
    .select()
    .from(accountsReceivable)
    .where(
      and(
        eq(accountsReceivable.customerId, id),
        eq(accountsReceivable.status, "pending"),
      ),
    );

  // Get segments for this customer
  const segments = await db
    .select({ segment: customerSegments.segment })
    .from(customerSegments)
    .where(eq(customerSegments.customerId, id));

  return c.json({
    customer: {
      ...customer,
      segments: segments.map((s) => s.segment),
    },
    receivables,
  });
});

/** POST /customers - Create a new customer. */
customersRoutes.post(
  "/customers",
  zValidator("json", createCustomerSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    try {
      const [customer] = await db
        .insert(customers)
        .values({
          businessId,
          name: data.name,
          phone: data.phone,
          email: data.email,
          address: data.address,
          notes: data.notes,
          creditLimitUsd: data.creditLimitUsd
            ? String(data.creditLimitUsd)
            : undefined,
        })
        .returning();

      return c.json({ customer }, 201);
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }
  },
);

/** PATCH /customers/:id - Update a customer. */
customersRoutes.patch(
  "/customers/:id",
  zValidator("json", updateCustomerSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const updateValues: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updateValues.name = data.name;
    if (data.phone !== undefined) updateValues.phone = data.phone;
    if (data.email !== undefined) updateValues.email = data.email;
    if (data.address !== undefined) updateValues.address = data.address;
    if (data.notes !== undefined) updateValues.notes = data.notes;
    if (data.creditLimitUsd !== undefined)
      updateValues.creditLimitUsd = String(data.creditLimitUsd);

    const [updated] = await db
      .update(customers)
      .set(updateValues)
      .where(and(eq(customers.id, id), eq(customers.businessId, businessId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Customer not found" }, 404);
    }

    return c.json({ customer: updated });
  },
);

// ============================================================
// Customer Segments
// ============================================================

/**
 * POST /customers/recalculate-segments - Recalculate segments for all customers.
 *
 * Runs calculateCustomerSegments() from @nova/shared for every active customer
 * in the business. Deletes old segments and inserts fresh ones in a transaction.
 *
 * Returns the count of customers processed and total segments assigned.
 */
customersRoutes.post("/customers/recalculate-segments", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  // Fetch all active customers for this business
  const allCustomers = await db
    .select({
      id: customers.id,
      totalSpentUsd: customers.totalSpentUsd,
      totalPurchases: customers.totalPurchases,
      lastPurchaseAt: customers.lastPurchaseAt,
      balanceUsd: customers.balanceUsd,
      createdAt: customers.createdAt,
    })
    .from(customers)
    .where(
      and(eq(customers.businessId, businessId), eq(customers.isActive, true)),
    );

  if (allCustomers.length === 0) {
    return c.json({ customersProcessed: 0, segmentsAssigned: 0 });
  }

  // Collect all spends for VIP threshold calculation
  const allSpends = allCustomers.map((c) => Number(c.totalSpentUsd));

  let totalSegments = 0;

  await db.transaction(async (tx) => {
    // Delete existing segments for this business
    await tx
      .delete(customerSegments)
      .where(eq(customerSegments.businessId, businessId));

    // Calculate and insert segments for each customer
    const segmentRows: Array<{
      customerId: string;
      businessId: string;
      segment: string;
    }> = [];

    for (const cust of allCustomers) {
      const segments = calculateCustomerSegments({
        totalSpentUsd: Number(cust.totalSpentUsd),
        totalPurchases: cust.totalPurchases,
        lastPurchaseAt: cust.lastPurchaseAt?.toISOString() ?? null,
        balanceUsd: Number(cust.balanceUsd),
        createdAt: cust.createdAt.toISOString(),
        allCustomerSpends: allSpends,
      });

      for (const segment of segments) {
        segmentRows.push({
          customerId: cust.id,
          businessId,
          segment,
        });
      }
    }

    if (segmentRows.length > 0) {
      await tx.insert(customerSegments).values(segmentRows);
    }

    totalSegments = segmentRows.length;
  });

  return c.json({
    customersProcessed: allCustomers.length,
    segmentsAssigned: totalSegments,
  });
});

// ============================================================
// Accounts Receivable
// ============================================================

/** GET /accounts/receivable - List pending accounts receivable. */
customersRoutes.get("/accounts/receivable", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const rows = await db
    .select()
    .from(accountsReceivable)
    .where(
      and(
        eq(accountsReceivable.businessId, businessId),
        eq(accountsReceivable.status, "pending"),
      ),
    )
    .orderBy(desc(accountsReceivable.createdAt));

  const totalPending = rows.reduce((sum, r) => sum + Number(r.balanceUsd), 0);

  return c.json({ accounts: rows, totalPending });
});

/**
 * POST /accounts/receivable/:id/payment - Record a payment against a receivable.
 *
 * Atomic: updates receivable balance, customer balance, and logs activity
 * in a single transaction. Rejects overpayment.
 */
customersRoutes.post(
  "/accounts/receivable/:id/payment",
  zValidator("json", recordPaymentSchema),
  async (c) => {
    const id = c.req.param("id");
    const { amountUsd, method, reference } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");

    const [account] = await db
      .select()
      .from(accountsReceivable)
      .where(
        and(
          eq(accountsReceivable.id, id),
          eq(accountsReceivable.businessId, businessId),
          eq(accountsReceivable.status, "pending"),
        ),
      )
      .limit(1);

    if (!account) {
      return c.json({ error: "Account not found or already paid" }, 404);
    }

    const currentBalance = Number(account.balanceUsd);

    // Reject overpayment
    if (amountUsd > currentBalance + 0.01) {
      return c.json(
        {
          error: `Payment $${amountUsd.toFixed(2)} exceeds balance $${currentBalance.toFixed(2)}`,
        },
        400,
      );
    }

    // Cap payment at balance to handle rounding
    const effectivePayment = Math.min(amountUsd, currentBalance);
    const newPaid = Number(account.paidUsd) + effectivePayment;
    const newBalance = Math.max(0, currentBalance - effectivePayment);
    const newStatus = newBalance <= 0.01 ? "paid" : "pending";

    // Atomic: update receivable + customer balance + log
    let result;
    try {
      result = await db.transaction(async (tx) => {
      const [updated] = await tx
        .update(accountsReceivable)
        .set({
          paidUsd: String(newPaid),
          balanceUsd: String(newBalance),
          status: newStatus,
          updatedAt: new Date(),
        })
        .where(eq(accountsReceivable.id, id))
        .returning();

      // Update customer balance
      await tx
        .update(customers)
        .set({
          balanceUsd: sql`GREATEST(0, ${customers.balanceUsd}::numeric - ${effectivePayment})`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, account.customerId));

      // Log activity
      await tx.insert(activityLog).values({
        businessId,
        userId: user.id,
        action: "payment_received",
        detail: `Payment $${effectivePayment.toFixed(2)} on receivable ${id.slice(0, 8)}${method ? ` via ${method}` : ""}${reference ? ` (ref: ${reference})` : ""}`,
      });

      return updated;
      });
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }

    return c.json({ account: result });
  },
);

/** POST /accounts/receivable/collect-all - Generate WhatsApp collection links. */
customersRoutes.post("/accounts/receivable/collect-all", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const pending = await db
    .select({
      id: accountsReceivable.id,
      customerId: accountsReceivable.customerId,
      balanceUsd: accountsReceivable.balanceUsd,
      customerName: customers.name,
      customerPhone: customers.phone,
    })
    .from(accountsReceivable)
    .innerJoin(customers, eq(accountsReceivable.customerId, customers.id))
    .where(
      and(
        eq(accountsReceivable.businessId, businessId),
        eq(accountsReceivable.status, "pending"),
      ),
    );

  const links = pending
    .filter((p) => p.customerPhone)
    .map((p) => ({
      customerId: p.customerId,
      customerName: p.customerName,
      amount: Number(p.balanceUsd),
      phone: p.customerPhone,
      whatsappUrl: `https://wa.me/${p.customerPhone?.replace(/[^0-9]/g, "")}?text=${encodeURIComponent(`Hola ${p.customerName}, tienes un saldo pendiente de $${Number(p.balanceUsd).toFixed(2)}. ¿Cuándo puedes realizar el pago?`)}`,
    }));

  return c.json({ message: "Collection messages generated", links });
});

// ============================================================
// Accounts Payable
// ============================================================

/** GET /accounts/payable - List pending accounts payable. */
customersRoutes.get("/accounts/payable", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const rows = await db
    .select()
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.businessId, businessId),
        eq(accountsPayable.status, "pending"),
      ),
    )
    .orderBy(desc(accountsPayable.createdAt));

  const totalPending = rows.reduce((sum, r) => sum + Number(r.balanceUsd), 0);

  return c.json({ accounts: rows, totalPending });
});

/** POST /accounts/payable - Create an account payable. */
customersRoutes.post(
  "/accounts/payable",
  zValidator("json", createAccountPayableSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [account] = await db
      .insert(accountsPayable)
      .values({
        businessId,
        supplierName: data.supplierName,
        description: data.description,
        amountUsd: String(data.amountUsd),
        balanceUsd: String(data.amountUsd),
        dueDate: data.dueDate ? new Date(data.dueDate) : undefined,
      })
      .returning();

    return c.json({ account }, 201);
  },
);

/**
 * PATCH /accounts/payable/:id/pay - Record a payment on an account payable.
 *
 * Rejects overpayment. Marks as paid when balance reaches zero.
 */
customersRoutes.patch(
  "/accounts/payable/:id/pay",
  zValidator("json", recordPaymentSchema),
  async (c) => {
    const id = c.req.param("id");
    const { amountUsd } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [account] = await db
      .select()
      .from(accountsPayable)
      .where(
        and(
          eq(accountsPayable.id, id),
          eq(accountsPayable.businessId, businessId),
          eq(accountsPayable.status, "pending"),
        ),
      )
      .limit(1);

    if (!account) {
      return c.json({ error: "Account not found or already paid" }, 404);
    }

    const currentBalance = Number(account.balanceUsd);

    if (amountUsd > currentBalance + 0.01) {
      return c.json(
        {
          error: `Payment $${amountUsd.toFixed(2)} exceeds balance $${currentBalance.toFixed(2)}`,
        },
        400,
      );
    }

    const effectivePayment = Math.min(amountUsd, currentBalance);
    const newPaid = Number(account.paidUsd) + effectivePayment;
    const newBalance = Math.max(0, currentBalance - effectivePayment);
    const newStatus = newBalance <= 0.01 ? "paid" : "pending";

    const [updated] = await db
      .update(accountsPayable)
      .set({
        paidUsd: String(newPaid),
        balanceUsd: String(newBalance),
        status: newStatus,
        updatedAt: new Date(),
      })
      .where(eq(accountsPayable.id, id))
      .returning();

    return c.json({ account: updated });
  },
);

// ============================================================
// Day Close
// ============================================================

/**
 * POST /day-close - Record end-of-day cash reconciliation.
 *
 * Calculates expected cash by summing ONLY cash ("efectivo") payments
 * from today's completed sales. Compares with the physical cash count.
 */
customersRoutes.post(
  "/day-close",
  zValidator("json", dayCloseSchema),
  async (c) => {
    const { cashCounted, notes } = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const businessId = c.get("businessId");

    // Use UTC boundaries for today
    const now = new Date();
    const dateStr = now.toISOString().split("T")[0];
    const todayStart = new Date(`${dateStr}T00:00:00.000Z`);
    const todayEnd = new Date(`${dateStr}T23:59:59.999Z`);

    // Get today's completed sales
    const todaySales = await db
      .select()
      .from(sales)
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "completed"),
          gte(sales.createdAt, todayStart),
          lte(sales.createdAt, todayEnd),
        ),
      );

    const totalSalesUsd = todaySales.reduce(
      (sum, s) => sum + Number(s.totalUsd),
      0,
    );
    const totalSalesCount = todaySales.length;

    // Calculate expected cash: sum of "efectivo" payments from today's sales
    const saleIds = todaySales.map((s) => s.id);
    let cashExpected = 0;

    if (saleIds.length > 0) {
      const cashPayments = await db
        .select({
          total: sql<number>`COALESCE(SUM(${salePayments.amountUsd}::numeric), 0)::float`,
        })
        .from(salePayments)
        .where(
          and(
            sql`${salePayments.saleId} = ANY(${saleIds})`,
            eq(salePayments.method, "efectivo"),
          ),
        );

      cashExpected = cashPayments[0]?.total ?? 0;
    }

    const cashDifference = cashCounted - cashExpected;

    // Count voided sales
    const [voidedResult] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(sales)
      .where(
        and(
          eq(sales.businessId, businessId),
          eq(sales.status, "voided"),
          gte(sales.createdAt, todayStart),
          lte(sales.createdAt, todayEnd),
        ),
      );

    const [dayClose] = await db
      .insert(dayCloses)
      .values({
        businessId,
        closedBy: user.id,
        date: now,
        cashCounted: String(cashCounted),
        cashExpected: String(cashExpected),
        cashDifference: String(cashDifference),
        totalSalesUsd: String(totalSalesUsd),
        totalSalesCount,
        totalVoidsCount: voidedResult?.count ?? 0,
        notes,
      })
      .returning();

    // Log activity
    await db.insert(activityLog).values({
      businessId,
      userId: user.id,
      action: "day_closed",
      detail: `Day close: counted $${cashCounted}, expected $${cashExpected.toFixed(2)}, diff $${cashDifference.toFixed(2)}`,
    });

    return c.json({ dayClose });
  },
);

/** GET /day-close/history - List past day closes. */
customersRoutes.get("/day-close/history", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const rows = await db
    .select()
    .from(dayCloses)
    .where(eq(dayCloses.businessId, businessId))
    .orderBy(desc(dayCloses.date))
    .limit(30);

  return c.json({ closes: rows });
});

// ============================================================
// Cash Register Opening
// ============================================================

const cashOpeningSchema = z.object({
  cashAmount: z.number().min(0),
  notes: z.string().max(500).optional(),
});

/**
 * POST /cash-opening - Record start-of-day cash amount.
 *
 * The owner declares how much cash is in the register at the start
 * of the day. This is compared with the day-close count later.
 */
customersRoutes.post(
  "/cash-opening",
  zValidator("json", cashOpeningSchema),
  async (c) => {
    const { cashAmount, notes } = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [opening] = await db
      .insert(cashOpenings)
      .values({
        businessId,
        openedBy: user.id,
        date: new Date(),
        cashAmount: String(cashAmount),
        notes,
      })
      .returning();

    // Log activity
    await db.insert(activityLog).values({
      businessId,
      userId: user.id,
      action: "cash_opened",
      detail: `Cash opening: $${cashAmount.toFixed(2)}${notes ? ` - ${notes}` : ""}`,
    });

    return c.json({ opening }, 201);
  },
);

/** GET /cash-opening/latest - Get the latest cash opening for today. */
customersRoutes.get("/cash-opening/latest", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const todayStr = new Date().toISOString().split("T")[0];
  const todayStart = new Date(`${todayStr}T00:00:00.000Z`);

  const [latest] = await db
    .select()
    .from(cashOpenings)
    .where(
      and(
        eq(cashOpenings.businessId, businessId),
        gte(cashOpenings.date, todayStart),
      ),
    )
    .orderBy(desc(cashOpenings.date))
    .limit(1);

  return c.json({ opening: latest ?? null });
});

export { customersRoutes };
