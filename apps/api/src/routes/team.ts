/**
 * Team management routes.
 *
 * Uses Clerk Organizations for member management:
 * - GET  /employees       - List org members via Clerk API
 * - POST /employees       - Invite employee via Clerk org invitation
 * - PATCH /employees/:id  - Update employee name or active status in DB
 * - DELETE /employees/:id - Deactivate employee (soft delete in DB)
 *
 * Clerk handles invitations, sign-up, and membership natively.
 * No custom linking, no webhooks, no temp passwords.
 * When an invited employee signs in, the authMiddleware auto-creates
 * their DB record on first request.
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
// List employees
// ============================================================

/**
 * GET /employees - List all members of the Clerk Organization.
 *
 * Combines Clerk membership data (email, invitation status) with
 * local DB data (name, active status) for a complete view.
 */
team.get("/employees", async (c) => {
  const ownerCheck = requireOwner(c);
  if (ownerCheck) return c.json(ownerCheck, 403);

  const currentUser = c.get("user");
  const db = c.get("db");

  // Get the Clerk org ID for this business
  const [business] = await db
    .select({ clerkOrgId: businesses.clerkOrgId })
    .from(businesses)
    .where(eq(businesses.id, currentUser.businessId))
    .limit(1);

  if (!business?.clerkOrgId) {
    // Fallback: list from DB only (no Clerk org linked)
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
  }

  // List members from Clerk Organization
  const clerk = getClerkClient();
  try {
    const memberships =
      await clerk.organizations.getOrganizationMembershipList({
        organizationId: business.clerkOrgId,
        limit: 100,
      });

    // Also get pending invitations
    const invitations =
      await clerk.organizations.getOrganizationInvitationList({
        organizationId: business.clerkOrgId,
        limit: 100,
      });

    // Build employee list from memberships
    const employees = memberships.data.map((m) => ({
      id: m.publicUserData?.userId ?? m.id,
      name:
        [m.publicUserData?.firstName, m.publicUserData?.lastName]
          .filter(Boolean)
          .join(" ") || "Sin nombre",
      role: m.role === "org:admin" ? "owner" : "employee",
      isActive: true,
      hasClerkAccount: true,
      email: m.publicUserData?.identifier ?? null,
      createdAt: m.createdAt ? new Date(m.createdAt).toISOString() : null,
    }));

    // Add pending invitations as "pending" employees
    const pendingInvites = invitations.data
      .filter((inv) => inv.status === "pending")
      .map((inv) => ({
        id: inv.id,
        name: inv.emailAddress,
        role: inv.role === "org:admin" ? "owner" : "employee",
        isActive: false,
        hasClerkAccount: false,
        email: inv.emailAddress,
        createdAt: inv.createdAt ? new Date(inv.createdAt).toISOString() : null,
        isPending: true,
      }));

    return c.json({ employees: [...employees, ...pendingInvites] });
  } catch (err) {
    console.error("[team] Failed to list Clerk org members:", err);

    // Fallback to DB
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
        hasClerkAccount: true,
      })),
    });
  }
});

// ============================================================
// Invite employee via Clerk Organization
// ============================================================

/**
 * POST /employees - Invite a new employee to the Clerk Organization.
 *
 * Accepts { name, email }. Sends a Clerk Organization invitation.
 * When the employee accepts, Clerk adds them to the org automatically.
 * On their first API request, authMiddleware auto-creates the DB record.
 *
 * No DB record is created here. No linking. No webhooks.
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

  // Get the Clerk org ID for this business
  const [business] = await db
    .select({ clerkOrgId: businesses.clerkOrgId, slug: businesses.slug })
    .from(businesses)
    .where(eq(businesses.id, currentUser.businessId))
    .limit(1);

  if (!business?.clerkOrgId) {
    return c.json(
      { error: "Este negocio no tiene una organizacion configurada." },
      400,
    );
  }

  try {
    // Send Clerk Organization invitation.
    // Clerk handles the email, sign-up flow, and org membership.
    const tenantDomain = process.env.TENANT_DOMAIN ?? "novaincs.com";
    const slug = business.slug ?? "nova";
    const redirectUrl = `https://${slug}.${tenantDomain}/`;

    await clerk.organizations.createOrganizationInvitation({
      organizationId: business.clerkOrgId,
      emailAddress: email,
      role: "org:member",
      inviterUserId: currentUser.clerkId,
      redirectUrl,
    });

    logActivity({
      db,
      businessId: currentUser.businessId,
      userId: currentUser.id,
      action: "employee_invited",
      detail: `${name} (${email})`,
    });

    return c.json(
      {
        message: `Invitacion enviada a ${email}. El empleado recibira un email para unirse al negocio.`,
        email,
        name,
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
    };
    if (clerkError.errors) {
      console.error(
        "[team] Clerk org invitation failed:",
        JSON.stringify(clerkError.errors, null, 2),
      );
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

// ============================================================
// Update employee
// ============================================================

/** Schema for updating an employee. */
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
