/**
 * Clerk webhook handler.
 *
 * Receives Clerk webhook events (via Svix) and processes them.
 *
 * Currently handles:
 * - `user.created`: Links a newly-created Clerk account to an existing
 *   Nova employee record. When an admin invites an employee via
 *   POST /employees, the employee record is created without a clerkId.
 *   When the employee accepts the invitation and signs up, Clerk fires
 *   `user.created` with publicMetadata containing `novaUserId`. This
 *   handler links the two records.
 *
 * Webhook verification uses Svix (Clerk's webhook infrastructure).
 * The signing secret is read from CLERK_WEBHOOK_SECRET env var.
 *
 * If the secret is not configured, the endpoint returns 500 to avoid
 * silently dropping events.
 */

import { Hono } from "hono";
import { Webhook } from "svix";
import { eq } from "drizzle-orm";
import { users } from "@nova/db";
import { getDb } from "../db";

const webhooks = new Hono();

/** Clerk webhook event shape (subset we care about). */
interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{
      email_address: string;
      id: string;
    }>;
    primary_email_address_id?: string;
    public_metadata?: {
      novaUserId?: string;
      businessId?: string;
      role?: string;
      name?: string;
    };
    first_name?: string | null;
    last_name?: string | null;
  };
}

/**
 * POST /webhooks/clerk - Receive Clerk webhook events.
 *
 * Svix headers required for verification:
 * - svix-id
 * - svix-timestamp
 * - svix-signature
 */
webhooks.post("/clerk", async (c) => {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET;

  if (!webhookSecret) {
    console.error(
      "[webhook] CLERK_WEBHOOK_SECRET not configured. Cannot verify webhooks.",
    );
    return c.json(
      { error: "Webhook secret not configured" },
      500,
    );
  }

  // Read raw body for signature verification
  const body = await c.req.text();

  // Extract Svix headers
  const svixId = c.req.header("svix-id");
  const svixTimestamp = c.req.header("svix-timestamp");
  const svixSignature = c.req.header("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    console.warn("[webhook] Missing Svix headers. Rejecting.");
    return c.json({ error: "Missing webhook verification headers" }, 400);
  }

  // Verify the webhook signature
  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(webhookSecret);
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error("[webhook] Signature verification failed:", err);
    return c.json({ error: "Invalid webhook signature" }, 400);
  }

  // Route by event type
  switch (event.type) {
    case "user.created":
      await handleUserCreated(event);
      break;
    default:
      console.info(`[webhook] Ignoring event type: ${event.type}`);
  }

  return c.json({ received: true });
});

/**
 * Handle `user.created` event from Clerk.
 *
 * When an employee accepts an invitation and creates their Clerk account,
 * this event fires with publicMetadata.novaUserId set to the employee's
 * Nova user ID. We link the Clerk account to the Nova record.
 *
 * If novaUserId is not in metadata (e.g., owner sign-up), we skip silently.
 */
async function handleUserCreated(event: ClerkWebhookEvent): Promise<void> {
  const clerkId = event.data.id;
  const meta = event.data.public_metadata;

  if (!meta?.novaUserId) {
    // Not an employee invitation -- likely an owner sign-up.
    // Owner linking happens in onboarding, not here.
    console.info(
      `[webhook] user.created for ${clerkId}: no novaUserId in metadata, skipping.`,
    );
    return;
  }

  const novaUserId = meta.novaUserId;

  try {
    const db = getDb();

    // Check if the employee record exists and doesn't already have a clerkId
    const [existing] = await db
      .select({ id: users.id, clerkId: users.clerkId })
      .from(users)
      .where(eq(users.id, novaUserId))
      .limit(1);

    if (!existing) {
      console.warn(
        `[webhook] user.created: Nova user ${novaUserId} not found. ` +
          `Clerk user ${clerkId} cannot be linked.`,
      );
      return;
    }

    if (existing.clerkId) {
      // Already linked (maybe by the authMiddleware on-the-fly linking)
      console.info(
        `[webhook] user.created: Nova user ${novaUserId} already linked ` +
          `to clerkId ${existing.clerkId}. Skipping.`,
      );
      return;
    }

    // Link the Clerk account to the Nova employee record
    await db
      .update(users)
      .set({ clerkId, updatedAt: new Date() })
      .where(eq(users.id, novaUserId));

    console.info(
      `[webhook] user.created: Linked clerkId ${clerkId} to Nova user ${novaUserId}.`,
    );
  } catch (err) {
    // Log but don't fail the webhook -- Clerk will retry on 5xx
    console.error(
      `[webhook] user.created: Error linking clerkId ${clerkId} to Nova user ${novaUserId}:`,
      err,
    );
  }
}

export { webhooks };
