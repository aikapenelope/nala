/**
 * Team management routes.
 *
 * GET    /team-roster       - Download employee list with PIN hashes for local cache (owner only)
 * POST   /switch-user       - Server-side user switch validation (fallback)
 * GET    /employees         - List employees (owner only)
 * POST   /employees         - Create employee with name + PIN (owner only)
 * PATCH  /employees/:id     - Update employee name or PIN (owner only)
 * DELETE /employees/:id     - Deactivate employee (owner only, soft delete)
 *
 * These endpoints support the "Clerk authenticates device, PIN identifies user"
 * pattern from AUTH-REFACTOR-PLAN.md.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { eq, and } from "drizzle-orm";
import { PIN_LENGTH } from "@nova/shared";
import { users, businesses } from "@nova/db";
import { handleDbError } from "../utils/db-errors";
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
// Team Roster (for local PIN cache)
// ============================================================

/**
 * GET /team-roster - Download employee roster for local PIN verification.
 * Owner only. Returns PIN hashes for client-side bcrypt comparison.
 */
team.get("/team-roster", async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const currentUser = c.get("user");
  const db = c.get("db");

  const roster = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      pinHash: users.pinHash,
    })
    .from(users)
    .where(
      and(
        eq(users.businessId, currentUser.businessId),
        eq(users.isActive, true),
      ),
    );

  return c.json({
    roster,
    businessId: currentUser.businessId,
    businessName: currentUser.businessName,
    generatedAt: new Date().toISOString(),
  });
});

// ============================================================
// Switch User (fallback)
// ============================================================

const switchUserSchema = z.object({
  userId: z.string().uuid(),
});

/**
 * POST /switch-user - Server-side user switch (fallback when no local roster).
 */
team.post("/switch-user", zValidator("json", switchUserSchema), async (c) => {
  const { userId } = c.req.valid("json");
  const currentUser = c.get("user");
  const db = c.get("db");

  const [targetUser] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      businessId: users.businessId,
    })
    .from(users)
    .where(
      and(
        eq(users.id, userId),
        eq(users.businessId, currentUser.businessId),
        eq(users.isActive, true),
      ),
    )
    .limit(1);

  if (!targetUser) {
    return c.json({ error: "User not found or not in this business" }, 404);
  }

  return c.json({
    user: {
      id: targetUser.id,
      name: targetUser.name,
      role: targetUser.role,
      businessId: targetUser.businessId,
      businessName: currentUser.businessName,
    },
  });
});

// ============================================================
// Employee CRUD (owner only)
// ============================================================

/**
 * GET /employees - List all employees for the business.
 * Returns name, role, active status. No PIN hashes (use /team-roster for that).
 */
team.get("/employees", async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const currentUser = c.get("user");
  const db = c.get("db");

  const employees = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      isActive: users.isActive,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.businessId, currentUser.businessId));

  return c.json({ employees });
});

/** Schema for creating an employee. */
const createEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
  pin: z.string().length(PIN_LENGTH),
});

/**
 * POST /employees - Create a new employee.
 *
 * Validates:
 * - PIN is not already used by another active user in the same business
 *   (bcrypt comparison against all existing hashes)
 */
team.post("/employees", zValidator("json", createEmployeeSchema), async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const { name, pin } = c.req.valid("json");
  const currentUser = c.get("user");
  const db = c.get("db");

  // Check for duplicate PIN within the business
  const existingUsers = await db
    .select({ id: users.id, pinHash: users.pinHash })
    .from(users)
    .where(
      and(
        eq(users.businessId, currentUser.businessId),
        eq(users.isActive, true),
      ),
    );

  for (const existing of existingUsers) {
    const isDuplicate = await bcrypt.compare(pin, existing.pinHash);
    if (isDuplicate) {
      return c.json(
        { error: "Este PIN ya esta en uso por otro miembro del equipo" },
        409,
      );
    }
  }

  const pinHash = await bcrypt.hash(pin, 10);

  try {
    const [employee] = await db
      .insert(users)
      .values({
        businessId: currentUser.businessId,
        name,
        role: "employee",
        pinHash,
      })
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    return c.json({ employee }, 201);
  } catch (err) {
    const dbErr = handleDbError(err);
    if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
    throw err;
  }
});

/** Schema for updating an employee. */
const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  pin: z.string().length(PIN_LENGTH).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /employees/:id - Update an employee.
 *
 * Can update name, PIN, or active status.
 * If PIN is changed, validates no duplicate within the business.
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

    // Verify the employee belongs to this business
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

    // Prevent editing the owner via this endpoint
    if (existing.role === "owner") {
      return c.json(
        { error: "No se puede editar al dueno desde esta seccion" },
        403,
      );
    }

    // Build update payload
    try {
    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (data.name !== undefined) {
      updates.name = data.name;
    }

    if (data.isActive !== undefined) {
      updates.isActive = data.isActive;
    }

    if (data.pin !== undefined) {
      // Check for duplicate PIN
      const otherUsers = await db
        .select({ id: users.id, pinHash: users.pinHash })
        .from(users)
        .where(
          and(
            eq(users.businessId, currentUser.businessId),
            eq(users.isActive, true),
          ),
        );

      for (const other of otherUsers) {
        if (other.id === employeeId) continue;
        const isDuplicate = await bcrypt.compare(data.pin, other.pinHash);
        if (isDuplicate) {
          return c.json(
            { error: "Este PIN ya esta en uso por otro miembro del equipo" },
            409,
          );
        }
      }

      updates.pinHash = await bcrypt.hash(data.pin, 10);
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
 *
 * Sets isActive = false. The employee can no longer use PIN to identify.
 * Their sales history is preserved.
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
team.patch(
  "/settings",
  zValidator("json", updateSettingsSchema),
  async (c) => {
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
  },
);

export { team };
