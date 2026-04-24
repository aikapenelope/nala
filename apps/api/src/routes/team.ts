/**
 * Team management routes.
 *
 * Simple DB-based employee management (no Clerk Organizations):
 * - GET  /employees       - List employees from DB
 * - POST /employees       - Create employee in DB
 * - PATCH /employees/:id  - Update employee name or active status
 * - DELETE /employees/:id - Deactivate employee (soft delete)
 *
 * GET /settings           - Get business settings
 * PATCH /settings         - Update business settings
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { users, businesses } from "@nova/db";
import { handleDbError } from "../utils/db-errors";
import { logActivity } from "../utils/audit";
import { validateUuidParam } from "../middleware/validate-uuid";
import type { AppEnv } from "../types";

const team = new Hono<AppEnv>();

/** Reusable owner-only guard. */
function requireOwner(c: { get: (key: string) => unknown }) {
  const user = c.get("user") as { role: string };
  if (user.role !== "owner") {
    return { error: "Solo el dueno puede gestionar el equipo" };
  }
  return null;
}

// ============================================================
// List employees
// ============================================================

/**
 * GET /employees - List all employees for this business from DB.
 */
team.get("/employees", async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const currentUser = c.get("user");
  const db = c.get("db");

  const dbEmployees = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.businessId, currentUser.businessId));

  return c.json({
    employees: dbEmployees.map((e) => ({
      ...e,
      hasClerkAccount: !!e.role,
    })),
  });
});

// ============================================================
// Create employee
// ============================================================

const createEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
  role: z.enum(["employee", "owner"]).default("employee"),
});

/**
 * POST /employees - Create a new employee in the DB.
 */
team.post(
  "/employees",
  zValidator("json", createEmployeeSchema),
  async (c) => {
    const ownerCheck = requireOwner(c);
    if (ownerCheck) return c.json(ownerCheck, 403);

    const data = c.req.valid("json");
    const currentUser = c.get("user");
    const db = c.get("db");

    try {
      const [created] = await db
        .insert(users)
        .values({
          businessId: currentUser.businessId,
          name: data.name,
          role: data.role,
        })
        .returning({
          id: users.id,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
          createdAt: users.createdAt,
        });

      logActivity({
        db,
        businessId: currentUser.businessId,
        userId: currentUser.id,
        action: "employee_created",
        detail: `${created.name}`,
      });

      return c.json({ employee: created }, 201);
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }
  },
);

// ============================================================
// Update employee
// ============================================================

const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /employees/:id - Update an employee's name or active status.
 */
team.patch(
  "/employees/:id",
  validateUuidParam,
  zValidator("json", updateEmployeeSchema),
  async (c) => {
    const ownerCheck = requireOwner(c);
    if (ownerCheck) return c.json(ownerCheck, 403);

    const employeeId = c.req.param("id");
    const data = c.req.valid("json");
    const currentUser = c.get("user");
    const db = c.get("db");

    const [existing] = await db
      .select()
      .from(users)
      .where(
        and(
          eq(users.id, employeeId),
          eq(users.businessId, currentUser.businessId),
        ),
      )
      .limit(1);

    if (!existing) {
      return c.json({ error: "Empleado no encontrado" }, 404);
    }

    if (existing.role === "owner") {
      return c.json(
        { error: "No se puede editar al dueno desde esta seccion" },
        403,
      );
    }

    try {
      const updates: Record<string, unknown> = { updatedAt: new Date() };

      if (data.name !== undefined) {
        updates.name = data.name;
      }

      if (data.isActive !== undefined) {
        updates.isActive = data.isActive;
      }

      const [updated] = await db
        .update(users)
        .set(updates)
        .where(eq(users.id, employeeId))
        .returning({
          id: users.id,
          name: users.name,
          role: users.role,
          isActive: users.isActive,
        });

      logActivity({
        db,
        businessId: currentUser.businessId,
        userId: currentUser.id,
        action: "employee_updated",
        detail: `${updated.name}`,
      });

      return c.json({ employee: updated });
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }
  },
);

/**
 * DELETE /employees/:id - Deactivate an employee (soft delete).
 */
team.delete("/employees/:id", validateUuidParam, async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const employeeId = c.req.param("id");
  const currentUser = c.get("user");
  const db = c.get("db");

  const [existing] = await db
    .select({ id: users.id, role: users.role })
    .from(users)
    .where(
      and(
        eq(users.id, employeeId),
        eq(users.businessId, currentUser.businessId),
      ),
    )
    .limit(1);

  if (!existing) {
    return c.json({ error: "Empleado no encontrado" }, 404);
  }

  if (existing.role === "owner") {
    return c.json({ error: "No se puede eliminar al dueno" }, 403);
  }

  await db
    .update(users)
    .set({ isActive: false, updatedAt: new Date() })
    .where(eq(users.id, employeeId));

  logActivity({
    db,
    businessId: currentUser.businessId,
    userId: currentUser.id,
    action: "employee_deactivated",
    detail: `Employee ${employeeId.slice(0, 8)}`,
  });

  return c.json({ success: true });
});

// ============================================================
// Business Settings
// ============================================================

const updateSettingsSchema = z.object({
  accountantEmail: z.string().email("Email invalido").optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
});

/** GET /settings - Get business settings. */
team.get("/settings", async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const currentUser = c.get("user");
  const db = c.get("db");

  const [business] = await db
    .select({
      accountantEmail: businesses.accountantEmail,
      whatsappNumber: businesses.whatsappNumber,
    })
    .from(businesses)
    .where(eq(businesses.id, currentUser.businessId))
    .limit(1);

  return c.json({ settings: business ?? {} });
});

/** PATCH /settings - Update business settings. */
team.patch("/settings", zValidator("json", updateSettingsSchema), async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const data = c.req.valid("json");
  const currentUser = c.get("user");
  const db = c.get("db");

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (data.accountantEmail !== undefined)
    updates.accountantEmail = data.accountantEmail;
  if (data.whatsappNumber !== undefined)
    updates.whatsappNumber = data.whatsappNumber;

  const [updated] = await db
    .update(businesses)
    .set(updates)
    .where(eq(businesses.id, currentUser.businessId))
    .returning({
      accountantEmail: businesses.accountantEmail,
      whatsappNumber: businesses.whatsappNumber,
    });

  return c.json({ settings: updated });
});

export { team };
