/**
 * Team management routes.
 *
 * GET    /employees              - List employees (owner only)
 * POST   /employees              - Invite employee via Clerk (owner only)
 * PATCH  /employees/:id          - Update employee name or active status (owner only)
 * DELETE /employees/:id          - Deactivate employee (owner only, soft delete)
 *
 * Employees receive a Clerk invitation email. When they accept and sign up,
 * their Clerk account is linked to the Nova employee record via /auth/resolve.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { createClerkClient } from "@clerk/backend";
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

/** Get a configured Clerk client. */
function getClerkClient() {
  return createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY ?? "",
  });
}

// ============================================================
// Employee CRUD (owner only)
// ============================================================

/**
 * GET /employees - List all employees for the business.
 * Returns name, role, active status, and whether they have a Clerk account.
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
      clerkId: users.clerkId,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.businessId, currentUser.businessId));

  return c.json({
    employees: employees.map((e) => ({
      ...e,
      hasClerkAccount: !!e.clerkId,
      clerkId: undefined, // Don't expose clerkId to frontend
    })),
  });
});

// ============================================================
// Employee creation
// ============================================================

/**
 * POST /employees - Invite a new employee via Clerk.
 *
 * Accepts { name, email }. Creates the employee record in the DB,
 * then tries Clerk invitation. If invitation fails, falls back to
 * creating the Clerk user directly with the real email + temp password.
 */
team.post("/employees", async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  // Manual validation for clear error messages
  let body: { name?: string; email?: string };
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Body JSON invalido" }, 400);
  }

  const name = body.name?.trim();
  const email = body.email?.trim();

  if (!name || name.length === 0) {
    return c.json({ error: "El nombre es obligatorio" }, 400);
  }
  if (!email || !email.includes("@")) {
    return c.json({ error: "El email es obligatorio y debe ser valido" }, 400);
  }
  const currentUser = c.get("user");
  const db = c.get("db");
  const clerk = getClerkClient();

  // Get business slug for redirect URL
  const [business] = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, currentUser.businessId))
    .limit(1);

  const slug = business?.slug ?? "nova";
  const tenantDomain = process.env.TENANT_DOMAIN ?? "novaincs.com";
  const redirectUrl = `https://${slug}.${tenantDomain}/auth/resolve`;

  try {
    // 1. Create employee record in DB (clerkId will be set after sign-up)
    const [employee] = await db
      .insert(users)
      .values({
        businessId: currentUser.businessId,
        name,
        role: "employee",
      })
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    // 2. Try to send Clerk invitation. If it fails (e.g., username required
    //    in Clerk dashboard), fall back to creating the user directly.
    let method: "invitation" | "direct" = "invitation";

    try {
      await clerk.invitations.createInvitation({
        emailAddress: email,
        redirectUrl,
        publicMetadata: {
          businessId: currentUser.businessId,
          novaUserId: employee.id,
          role: "employee",
          name,
        },
      });
    } catch (inviteErr) {
      // Invitation failed -- fall back to direct user creation
      console.warn(
        "[team] Invitation failed, falling back to createUser:",
        inviteErr instanceof Error ? inviteErr.message : inviteErr,
      );
      method = "direct";

      // Generate a temporary password (employee can reset later)
      const tempPassword = `Nova!${crypto.randomUUID().slice(0, 12)}`;

      const clerkUser = await clerk.users.createUser({
        emailAddress: [email],
        firstName: name,
        password: tempPassword,
        skipPasswordChecks: true,
        publicMetadata: {
          businessId: currentUser.businessId,
          novaUserId: employee.id,
          role: "employee",
        },
      });

      // Link the Clerk user to the Nova employee record
      await db
        .update(users)
        .set({ clerkId: clerkUser.id, updatedAt: new Date() })
        .where(eq(users.id, employee.id));
    }

    logActivity({
      db,
      businessId: currentUser.businessId,
      userId: currentUser.id,
      action: "employee_invited",
      detail: `${name} (${email})`,
    });

    return c.json(
      {
        employee: {
          ...employee,
          hasClerkAccount: method === "direct",
          email,
        },
        message:
          method === "invitation"
            ? `Invitacion enviada a ${email}`
            : `Cuenta creada para ${email}. El empleado puede iniciar sesion con su email.`,
        method,
      },
      201,
    );
  } catch (err) {
    // Handle Clerk API errors
    const clerkError = err as {
      errors?: Array<{
        message: string;
        code: string;
        longMessage?: string;
        meta?: Record<string, unknown>;
      }>;
      status?: number;
      clerkError?: boolean;
    };
    if (clerkError.errors) {
      console.error(
        "[team] Clerk invitation failed:",
        JSON.stringify(clerkError.errors, null, 2),
      );
      // Return all error details for debugging
      const messages = clerkError.errors
        .map(
          (e) =>
            e.longMessage ??
            e.message ??
            `${e.code}: ${JSON.stringify(e.meta)}`,
        )
        .join(". ");
      return c.json(
        {
          error: messages || "Error enviando invitacion",
          clerkErrors: clerkError.errors,
        },
        400,
      );
    }

    const dbErr = handleDbError(err);
    if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
    throw err;
  }
});

/** Schema for updating an employee. */
const updateEmployeeSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  isActive: z.boolean().optional(),
});

/**
 * PATCH /employees/:id - Update an employee.
 *
 * Can update name or active status. No more PIN management.
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
 *
 * Sets isActive = false. The employee can no longer authenticate.
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
