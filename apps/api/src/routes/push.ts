/**
 * Push notification subscription routes.
 *
 * POST   /push/subscribe     - Register a push subscription
 * DELETE /push/subscribe     - Unregister a push subscription
 * GET    /push/vapid-key     - Get the VAPID public key
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { pushSubscriptions } from "@nova/db";
import type { AppEnv } from "../types";

const pushRoutes = new Hono<AppEnv>();

/** Schema for push subscription registration. */
const subscribeSchema = z.object({
  subscription: z.object({
    endpoint: z.string().url(),
    keys: z.object({
      p256dh: z.string().min(1),
      auth: z.string().min(1),
    }),
    expirationTime: z.number().nullable().optional(),
  }),
});

/**
 * GET /push/vapid-key - Return the VAPID public key.
 *
 * The frontend needs this to call pushManager.subscribe().
 * Returns 503 if VAPID keys are not configured.
 */
pushRoutes.get("/push/vapid-key", (c) => {
  const vapidPublicKey = process.env.VAPID_PUBLIC_KEY;

  if (!vapidPublicKey) {
    return c.json({ error: "Push notifications not configured" }, 503);
  }

  return c.json({ vapidPublicKey });
});

/**
 * POST /push/subscribe - Register a push subscription.
 *
 * Upserts by endpoint URL: if the same browser re-subscribes
 * (e.g., after key rotation), the existing record is updated.
 */
pushRoutes.post(
  "/push/subscribe",
  zValidator("json", subscribeSchema),
  async (c) => {
    const { subscription } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");
    const user = c.get("user");
    const userAgent = c.req.header("user-agent") ?? null;

    // Upsert: delete existing subscription for this endpoint, then insert.
    // Scoped to businessId to prevent cross-tenant subscription hijacking.
    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, subscription.endpoint),
          eq(pushSubscriptions.businessId, businessId),
        ),
      );

    await db.insert(pushSubscriptions).values({
      businessId,
      userId: user.id,
      endpoint: subscription.endpoint,
      subscription,
      userAgent,
    });

    return c.json({ success: true });
  },
);

/**
 * DELETE /push/subscribe - Unregister a push subscription.
 *
 * Body: { endpoint: "https://..." }
 * Removes the subscription so the server stops sending pushes.
 */
const unsubscribeSchema = z.object({
  endpoint: z.string().url(),
});

pushRoutes.delete(
  "/push/subscribe",
  zValidator("json", unsubscribeSchema),
  async (c) => {
    const { endpoint } = c.req.valid("json");
    const db = c.get("db");
    const businessId = c.get("businessId");

    await db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, endpoint),
          eq(pushSubscriptions.businessId, businessId),
        ),
      );

    return c.json({ success: true });
  },
);

export { pushRoutes };
