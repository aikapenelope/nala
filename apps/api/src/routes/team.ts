/**
 * Business settings routes.
 *
 * Single-user model: no employee management needed.
 * Only business-level settings remain.
 *
 * GET /settings           - Get business settings
 * PATCH /settings         - Update business settings
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { businesses } from "@nova/db";
import type { AppEnv } from "../types";

const team = new Hono<AppEnv>();

// ============================================================
// Business Settings
// ============================================================

const updateSettingsSchema = z.object({
  accountantEmail: z.string().email("Email invalido").optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
});

/** GET /settings - Get business settings. */
team.get("/settings", async (c) => {
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
  const currentUser = c.get("user");
  const db = c.get("db");

  const data = c.req.valid("json");

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
