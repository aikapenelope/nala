/**
 * Supplier management routes.
 *
 * GET    /suppliers          - List suppliers
 * POST   /suppliers          - Create supplier
 * PATCH  /suppliers/:id      - Update supplier
 * GET    /suppliers/:id/account - Supplier account summary
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { suppliers, expenses, accountsPayable } from "@nova/db";
import { handleDbError } from "../utils/db-errors";
import { logActivity } from "../utils/audit";
import { validateUuidParam } from "../middleware/validate-uuid";
import type { AppEnv } from "../types";

const suppliersRoutes = new Hono<AppEnv>();

const createSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  rif: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(500).optional(),
  notes: z.string().max(1000).optional(),
});

const listSuppliersQuery = z.object({
  search: z.string().optional(),
});

/** Escape LIKE special characters. */
function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, "\\$&");
}

/** GET /suppliers - List suppliers. */
suppliersRoutes.get(
  "/suppliers",
  zValidator("query", listSuppliersQuery),
  async (c) => {
    const { search } = c.req.valid("query");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const conditions = [
      eq(suppliers.businessId, businessId),
      eq(suppliers.isActive, true),
    ];

    if (search) {
      conditions.push(ilike(suppliers.name, `%${escapeLike(search)}%`));
    }

    const rows = await db
      .select()
      .from(suppliers)
      .where(and(...conditions))
      .orderBy(desc(suppliers.updatedAt))
      .limit(500);

    return c.json({ suppliers: rows });
  },
);

/** POST /suppliers - Create supplier. */
suppliersRoutes.post(
  "/suppliers",
  zValidator("json", createSupplierSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    try {
      const [supplier] = await db
        .insert(suppliers)
        .values({ businessId, ...data })
        .returning();

      return c.json({ supplier }, 201);
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }
  },
);

/** PATCH /suppliers/:id - Update supplier. */
suppliersRoutes.patch(
  "/suppliers/:id",
  validateUuidParam,
  zValidator("json", createSupplierSchema.partial()),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.rif !== undefined) updates.rif = data.rif;
    if (data.phone !== undefined) updates.phone = data.phone;
    if (data.email !== undefined) updates.email = data.email;
    if (data.address !== undefined) updates.address = data.address;
    if (data.notes !== undefined) updates.notes = data.notes;

    const [updated] = await db
      .update(suppliers)
      .set(updates)
      .where(and(eq(suppliers.id, id), eq(suppliers.businessId, businessId)))
      .returning();

    if (!updated) {
      return c.json({ error: "Proveedor no encontrado" }, 404);
    }

    const user = c.get("user");
    logActivity({ db, businessId, userId: user.id, action: "supplier_updated", detail: `${updated.name}` });

    return c.json({ supplier: updated });
  },
);

/**
 * GET /suppliers/:id/account - Supplier account summary.
 *
 * Returns total purchases, pending payables, and recent expenses
 * for a specific supplier.
 */
suppliersRoutes.get("/suppliers/:id/account", validateUuidParam, async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  // Verify supplier exists
  const [supplier] = await db
    .select()
    .from(suppliers)
    .where(and(eq(suppliers.id, id), eq(suppliers.businessId, businessId)))
    .limit(1);

  if (!supplier) {
    return c.json({ error: "Proveedor no encontrado" }, 404);
  }

  // Total purchases from this supplier
  const [purchaseStats] = await db
    .select({
      totalPurchases: sql<number>`COALESCE(SUM(${expenses.total}::numeric), 0)::float`,
      purchaseCount: sql<number>`count(*)::int`,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.businessId, businessId),
        eq(expenses.supplierId, id),
        eq(expenses.status, "confirmed"),
      ),
    );

  // Pending payables for this supplier
  const [payableStats] = await db
    .select({
      totalPending: sql<number>`COALESCE(SUM(${accountsPayable.balanceUsd}::numeric), 0)::float`,
      pendingCount: sql<number>`count(*)::int`,
    })
    .from(accountsPayable)
    .where(
      and(
        eq(accountsPayable.businessId, businessId),
        eq(accountsPayable.supplierName, supplier.name),
        eq(accountsPayable.status, "pending"),
      ),
    );

  // Recent expenses (last 10)
  const recentExpenses = await db
    .select({
      id: expenses.id,
      date: expenses.date,
      total: expenses.total,
      invoiceNumber: expenses.invoiceNumber,
    })
    .from(expenses)
    .where(
      and(
        eq(expenses.businessId, businessId),
        eq(expenses.supplierId, id),
      ),
    )
    .orderBy(desc(expenses.date))
    .limit(10);

  return c.json({
    supplier,
    account: {
      totalPurchases: Math.round((purchaseStats?.totalPurchases ?? 0) * 100) / 100,
      purchaseCount: purchaseStats?.purchaseCount ?? 0,
      totalPending: Math.round((payableStats?.totalPending ?? 0) * 100) / 100,
      pendingCount: payableStats?.pendingCount ?? 0,
    },
    recentExpenses,
  });
});

export { suppliersRoutes };
