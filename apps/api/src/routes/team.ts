/**
 * Team management routes.
 *
 * GET    /employees              - List employees (owner only)
 * POST   /employees              - Create employee with Clerk account + access link (owner only)
 * PATCH  /employees/:id          - Update employee name or active status (owner only)
 * DELETE /employees/:id          - Deactivate employee (owner only, soft delete)
 * POST   /employees/:id/access-link - Generate a new sign-in token link (owner only)
 *
 * Employees authenticate with their own Clerk JWT via sign-in tokens.
 * The admin generates a link that the employee opens to get authenticated.
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

/**
 * Default sign-in token expiry: 30 days (maximum allowed by Clerk).
 * On the Hobby plan, session lifetime is fixed at 7 days, but the
 * sign-in token itself can last up to 30 days before being used.
 */
const SIGN_IN_TOKEN_EXPIRY_SECONDS = 30 * 24 * 60 * 60;

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

/** Schema for creating an employee. */
const createEmployeeSchema = z.object({
  name: z.string().min(1).max(100),
});

/**
 * POST /employees - Create a new employee with a Clerk account.
 *
 * 1. Creates a Clerk user (with username derived from business slug + name)
 * 2. Creates the employee record in the DB linked to the Clerk user
 * 3. Generates a sign-in token for the employee
 * 4. Returns the access link
 */
team.post("/employees", zValidator("json", createEmployeeSchema), async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const { name } = c.req.valid("json");
  const currentUser = c.get("user");
  const db = c.get("db");
  const clerk = getClerkClient();

  // Get business slug for username generation
  const [business] = await db
    .select({ slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, currentUser.businessId))
    .limit(1);

  const slug = business?.slug ?? "nova";

  // Generate a unique username: {slug}-{sanitized-name}-{random}
  const sanitizedName = name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .slice(0, 20);
  const randomSuffix = Math.random().toString(36).slice(2, 7);
  const username = `${slug}-${sanitizedName}-${randomSuffix}`;

  try {
    // 1. Create Clerk user (no email required, username-only)
    const clerkUser = await clerk.users.createUser({
      username,
      firstName: name,
      skipPasswordRequirement: true,
    });

    // 2. Create employee record in DB
    const [employee] = await db
      .insert(users)
      .values({
        businessId: currentUser.businessId,
        name,
        role: "employee",
        clerkId: clerkUser.id,
      })
      .returning({
        id: users.id,
        name: users.name,
        role: users.role,
        isActive: users.isActive,
        createdAt: users.createdAt,
      });

    // 3. Generate sign-in token
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: clerkUser.id,
      expiresInSeconds: SIGN_IN_TOKEN_EXPIRY_SECONDS,
    });

    // 4. Build the access link using the business subdomain
    const tenantDomain = process.env.TENANT_DOMAIN ?? "novaincs.com";
    const accessUrl = `https://${slug}.${tenantDomain}/auth/accept-token?token=${signInToken.token}`;

    logActivity({
      db,
      businessId: currentUser.businessId,
      userId: currentUser.id,
      action: "employee_created",
      detail: name,
    });

    return c.json(
      {
        employee: { ...employee, hasClerkAccount: true },
        accessLink: accessUrl,
      },
      201,
    );
  } catch (err) {
    // Handle Clerk API errors
    const clerkError = err as { errors?: Array<{ message: string }> };
    if (clerkError.errors) {
      return c.json(
        {
          error:
            clerkError.errors[0]?.message ?? "Error creating Clerk account",
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
// Access Link Generation
// ============================================================

/**
 * POST /employees/:id/access-link - Generate a new sign-in token link.
 *
 * Creates a new Clerk sign-in token for the employee and returns
 * a link that the admin can share (WhatsApp, QR, etc.).
 * The previous token is implicitly invalidated when a new one is created.
 */
team.post("/employees/:id/access-link", validateUuidParam, async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const employeeId = c.req.param("id");
  const currentUser = c.get("user");
  const db = c.get("db");
  const clerk = getClerkClient();

  // Find the employee
  const [employee] = await db
    .select({
      id: users.id,
      name: users.name,
      role: users.role,
      clerkId: users.clerkId,
      isActive: users.isActive,
    })
    .from(users)
    .where(
      and(
        eq(users.id, employeeId),
        eq(users.businessId, currentUser.businessId),
      ),
    )
    .limit(1);

  if (!employee) {
    return c.json({ error: "Empleado no encontrado" }, 404);
  }

  if (!employee.isActive) {
    return c.json({ error: "El empleado esta desactivado" }, 400);
  }

  if (employee.role === "owner") {
    return c.json(
      { error: "El dueno no necesita link de acceso (usa Clerk directamente)" },
      400,
    );
  }

  if (!employee.clerkId) {
    return c.json(
      { error: "El empleado no tiene cuenta Clerk. Recrealo desde el panel." },
      400,
    );
  }

  try {
    // Generate a new sign-in token
    const signInToken = await clerk.signInTokens.createSignInToken({
      userId: employee.clerkId,
      expiresInSeconds: SIGN_IN_TOKEN_EXPIRY_SECONDS,
    });

    // Build the access link
    const [business] = await db
      .select({ slug: businesses.slug })
      .from(businesses)
      .where(eq(businesses.id, currentUser.businessId))
      .limit(1);

    const slug = business?.slug ?? "nova";
    const tenantDomain = process.env.TENANT_DOMAIN ?? "novaincs.com";
    const accessUrl = `https://${slug}.${tenantDomain}/auth/accept-token?token=${signInToken.token}`;

    logActivity({
      db,
      businessId: currentUser.businessId,
      userId: currentUser.id,
      action: "access_link_generated",
      detail: employee.name,
    });

    return c.json({ accessLink: accessUrl });
  } catch (err) {
    const clerkError = err as { errors?: Array<{ message: string }> };
    if (clerkError.errors) {
      return c.json(
        {
          error:
            clerkError.errors[0]?.message ?? "Error generating access link",
        },
        500,
      );
    }
    throw err;
  }
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
