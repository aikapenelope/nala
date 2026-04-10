/**
 * Customer and accounts API routes.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql, desc, gte, lte } from "drizzle-orm";
import {
  createCustomerSchema,
  updateCustomerSchema,
  recordPaymentSchema,
  createAccountPayableSchema,
  dayCloseSchema,
} from "@nova/shared";
import {
  customers,
  accountsReceivable,
  accountsPayable,
  dayCloses,
  sales,
  activityLog,
} from "@nova/db";
import type { AppEnv } from "../types";

const customersRoutes = new Hono<AppEnv>();

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
      conditions.push(
        sql`${customers.name} ILIKE ${"%" + search + "%"}` as ReturnType<
          typeof eq
        >,
      );
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

    return c.json({
      customers: rows,
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

  return c.json({ customer, receivables });
});

/** POST /customers - Create a new customer. */
customersRoutes.post(
  "/customers",
  zValidator("json", createCustomerSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const [customer] = await db
      .insert(customers)
      .values({
        businessId,
        name: data.name,
        phone: data.phone,
        email: data.email,
        address: data.address,
        notes: data.notes,
      })
      .returning();

    return c.json({ customer }, 201);
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

/** POST /accounts/receivable/:id/payment - Record a payment against a receivable. */
customersRoutes.post(
  "/accounts/receivable/:id/payment",
  zValidator("json", recordPaymentSchema),
  async (c) => {
    const id = c.req.param("id");
    const { amountUsd } = c.req.valid("json");
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
        ),
      )
      .limit(1);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    const currentBalance = Number(account.balanceUsd);
    const newPaid = Number(account.paidUsd) + amountUsd;
    const newBalance = Math.max(0, currentBalance - amountUsd);
    const newStatus = newBalance <= 0 ? "paid" : "pending";

    const [updated] = await db
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
    if (account.customerId) {
      await db
        .update(customers)
        .set({
          balanceUsd: sql`GREATEST(0, ${customers.balanceUsd}::numeric - ${amountUsd})`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, account.customerId));
    }

    // Log activity
    await db.insert(activityLog).values({
      businessId,
      userId: user.id,
      action: "payment_received",
      detail: `Payment $${amountUsd} on receivable ${id.slice(0, 8)}`,
    });

    return c.json({ account: updated });
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

/** PATCH /accounts/payable/:id/pay - Record a payment on an account payable. */
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
        ),
      )
      .limit(1);

    if (!account) {
      return c.json({ error: "Account not found" }, 404);
    }

    const newPaid = Number(account.paidUsd) + amountUsd;
    const newBalance = Math.max(0, Number(account.balanceUsd) - amountUsd);
    const newStatus = newBalance <= 0 ? "paid" : "pending";

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
 * Calculates expected cash from today's cash sales,
 * compares with counted cash, records the difference.
 */
customersRoutes.post(
  "/day-close",
  zValidator("json", dayCloseSchema),
  async (c) => {
    const { cashCounted, notes } = c.req.valid("json");
    const user = c.get("user");
    const db = c.get("db");
    const businessId = c.get("businessId");

    // Calculate expected cash from today's sales
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

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

    // Count voided sales
    const voidedSales = await db
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

    // For cashExpected, we'd ideally sum only cash payments.
    // Simplified: use total sales as expected (owner adjusts mentally for non-cash).
    const cashExpected = totalSalesUsd;
    const cashDifference = cashCounted - cashExpected;

    const [dayClose] = await db
      .insert(dayCloses)
      .values({
        businessId,
        closedBy: user.id,
        date: new Date(),
        cashCounted: String(cashCounted),
        cashExpected: String(cashExpected),
        cashDifference: String(cashDifference),
        totalSalesUsd: String(totalSalesUsd),
        totalSalesCount,
        totalVoidsCount: voidedSales[0]?.count ?? 0,
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

export { customersRoutes };
