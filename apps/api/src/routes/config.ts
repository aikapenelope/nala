/**
 * Settings-related API routes for business configuration.
 *
 * GET    /surcharge-types          - List surcharge types
 * POST   /surcharge-types          - Create surcharge type
 * PATCH  /surcharge-types/:id      - Update surcharge type
 * DELETE /surcharge-types/:id      - Deactivate surcharge type
 *
 * GET    /bank-accounts            - List bank accounts
 * POST   /bank-accounts            - Create bank account
 * PATCH  /bank-accounts/:id        - Update bank account
 *
 * GET    /notification-preferences - Get notification preferences
 * PATCH  /notification-preferences - Update notification preferences
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and, sql } from "drizzle-orm";
import {
  surchargeTypes,
  bankAccounts,
  notificationPreferences,
  salePayments,
  sales,
} from "@nova/db";
import { handleDbError } from "../utils/db-errors";
import type { AppEnv } from "../types";

const configRoutes = new Hono<AppEnv>();

// ============================================================
// Surcharge Types
// ============================================================

const createSurchargeTypeSchema = z.object({
  name: z.string().min(1).max(100),
  /** Fixed amount in USD (mutually exclusive with percentage). */
  amount: z.number().min(0).optional(),
  /** Percentage of sale total (mutually exclusive with amount). */
  percentage: z.number().min(0).max(100).optional(),
});

/** GET /surcharge-types - List active surcharge types. */
configRoutes.get("/surcharge-types", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const rows = await db
    .select()
    .from(surchargeTypes)
    .where(
      and(
        eq(surchargeTypes.businessId, businessId),
        eq(surchargeTypes.isActive, true),
      ),
    );

  return c.json({ surchargeTypes: rows });
});

/** POST /surcharge-types - Create a surcharge type. */
configRoutes.post(
  "/surcharge-types",
  zValidator("json", createSurchargeTypeSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    try {
      const [surcharge] = await db
        .insert(surchargeTypes)
        .values({
          businessId,
          name: data.name,
          amount: data.amount !== undefined ? String(data.amount) : null,
          percentage:
            data.percentage !== undefined ? String(data.percentage) : null,
        })
        .returning();

      return c.json({ surchargeType: surcharge }, 201);
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }
  },
);

/** PATCH /surcharge-types/:id - Update a surcharge type. */
configRoutes.patch(
  "/surcharge-types/:id",
  zValidator("json", createSurchargeTypeSchema.partial()),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const updates: Record<string, unknown> = {};
    if (data.name !== undefined) updates.name = data.name;
    if (data.amount !== undefined) updates.amount = String(data.amount);
    if (data.percentage !== undefined)
      updates.percentage = String(data.percentage);

    const [updated] = await db
      .update(surchargeTypes)
      .set(updates)
      .where(
        and(
          eq(surchargeTypes.id, id),
          eq(surchargeTypes.businessId, businessId),
        ),
      )
      .returning();

    if (!updated) {
      return c.json({ error: "Cargo adicional no encontrado" }, 404);
    }

    return c.json({ surchargeType: updated });
  },
);

/** DELETE /surcharge-types/:id - Deactivate a surcharge type. */
configRoutes.delete("/surcharge-types/:id", async (c) => {
  const id = c.req.param("id");
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [deleted] = await db
    .update(surchargeTypes)
    .set({ isActive: false })
    .where(
      and(
        eq(surchargeTypes.id, id),
        eq(surchargeTypes.businessId, businessId),
      ),
    )
    .returning();

  if (!deleted) {
    return c.json({ error: "Cargo adicional no encontrado" }, 404);
  }

  return c.json({ success: true });
});

// ============================================================
// Bank Accounts
// ============================================================

const createBankAccountSchema = z.object({
  name: z.string().min(1).max(100),
  bankName: z.string().max(100).optional(),
  accountType: z.enum(["checking", "savings", "cash", "digital"]).default("checking"),
  initialBalance: z.number().min(0).default(0),
});

/** GET /bank-accounts - List bank accounts with calculated balances. */
configRoutes.get("/bank-accounts", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const accounts = await db
    .select()
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.businessId, businessId),
        eq(bankAccounts.isActive, true),
      ),
    );

  return c.json({ bankAccounts: accounts });
});

/** POST /bank-accounts - Create a bank account. */
configRoutes.post(
  "/bank-accounts",
  zValidator("json", createBankAccountSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    try {
      const [account] = await db
        .insert(bankAccounts)
        .values({
          businessId,
          name: data.name,
          bankName: data.bankName,
          accountType: data.accountType,
          initialBalance: String(data.initialBalance),
        })
        .returning();

      return c.json({ bankAccount: account }, 201);
    } catch (err) {
      const dbErr = handleDbError(err);
      if (dbErr) return c.json({ error: dbErr.message }, dbErr.status);
      throw err;
    }
  },
);

/** PATCH /bank-accounts/:id - Update a bank account. */
configRoutes.patch(
  "/bank-accounts/:id",
  zValidator("json", createBankAccountSchema.partial()),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (data.name !== undefined) updates.name = data.name;
    if (data.bankName !== undefined) updates.bankName = data.bankName;
    if (data.accountType !== undefined) updates.accountType = data.accountType;
    if (data.initialBalance !== undefined)
      updates.initialBalance = String(data.initialBalance);

    const [updated] = await db
      .update(bankAccounts)
      .set(updates)
      .where(
        and(
          eq(bankAccounts.id, id),
          eq(bankAccounts.businessId, businessId),
        ),
      )
      .returning();

    if (!updated) {
      return c.json({ error: "Cuenta bancaria no encontrada" }, 404);
    }

    return c.json({ bankAccount: updated });
  },
);

// ============================================================
// Notification Preferences
// ============================================================

const updateNotificationSchema = z.object({
  emailDailyAlerts: z.boolean().optional(),
  alertEmail: z.string().email().optional().nullable(),
});

/** GET /notification-preferences - Get notification preferences. */
configRoutes.get("/notification-preferences", async (c) => {
  const db = c.get("db");
  const businessId = c.get("businessId");

  const [prefs] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.businessId, businessId))
    .limit(1);

  return c.json({
    preferences: prefs ?? { emailDailyAlerts: false, alertEmail: null },
  });
});

/** PATCH /notification-preferences - Update notification preferences. */
configRoutes.patch(
  "/notification-preferences",
  zValidator("json", updateNotificationSchema),
  async (c) => {
    const data = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    // Upsert: insert if not exists, update if exists
    const [existing] = await db
      .select({ id: notificationPreferences.id })
      .from(notificationPreferences)
      .where(eq(notificationPreferences.businessId, businessId))
      .limit(1);

    let result;
    if (existing) {
      const updates: Record<string, unknown> = { updatedAt: new Date() };
      if (data.emailDailyAlerts !== undefined)
        updates.emailDailyAlerts = data.emailDailyAlerts;
      if (data.alertEmail !== undefined) updates.alertEmail = data.alertEmail;

      [result] = await db
        .update(notificationPreferences)
        .set(updates)
        .where(eq(notificationPreferences.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(notificationPreferences)
        .values({
          businessId,
          emailDailyAlerts: data.emailDailyAlerts ?? false,
          alertEmail: data.alertEmail,
        })
        .returning();
    }

    return c.json({ preferences: result });
  },
);

export { configRoutes };
