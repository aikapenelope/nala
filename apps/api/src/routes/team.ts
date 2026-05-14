/**
 * Business settings routes.
 *
 * Single-user model: employee management removed.
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
  name: z.string().min(1, "Nombre es obligatorio").max(100).optional(),
  slug: z
    .string()
    .min(3, "Minimo 3 caracteres")
    .max(50)
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Solo letras minusculas, numeros y guiones",
    )
    .optional(),
  phone: z.string().max(20).optional().nullable(),
  address: z.string().max(200).optional().nullable(),
  accountantEmail: z.string().email("Email invalido").optional().nullable(),
  whatsappNumber: z.string().max(20).optional().nullable(),
});

/** GET /settings - Get business settings. */
team.get("/settings", async (c) => {
  const currentUser = c.get("user");
  const db = c.get("db");

  const [business] = await db
    .select({
      name: businesses.name,
      slug: businesses.slug,
      phone: businesses.phone,
      address: businesses.address,
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
  if (data.name !== undefined) updates.name = data.name;
  if (data.slug !== undefined) updates.slug = data.slug;
  if (data.phone !== undefined) updates.phone = data.phone;
  if (data.address !== undefined) updates.address = data.address;
  if (data.accountantEmail !== undefined)
    updates.accountantEmail = data.accountantEmail;
  if (data.whatsappNumber !== undefined)
    updates.whatsappNumber = data.whatsappNumber;

  const [updated] = await db
    .update(businesses)
    .set(updates)
    .where(eq(businesses.id, currentUser.businessId))
    .returning({
      name: businesses.name,
      slug: businesses.slug,
      phone: businesses.phone,
      address: businesses.address,
      accountantEmail: businesses.accountantEmail,
      whatsappNumber: businesses.whatsappNumber,
    });

  return c.json({ settings: updated });
});

export { team };
