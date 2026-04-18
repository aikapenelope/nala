/**
 * Supplier management routes.
 *
 * GET    /suppliers          - List suppliers
 * POST   /suppliers          - Create supplier
 * PATCH  /suppliers/:id      - Update supplier
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, desc, ilike } from "drizzle-orm";
import { suppliers } from "@nova/db";
import { handleDbError } from "../utils/db-errors";
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
      .orderBy(desc(suppliers.updatedAt));

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

    return c.json({ supplier: updated });
  },
);

export { suppliersRoutes };
