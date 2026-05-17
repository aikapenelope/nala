/**
 * Push notification service.
 *
 * Sends Web Push notifications to subscribed devices using the
 * web-push library. VAPID keys are configured via environment variables:
 *
 * - VAPID_PUBLIC_KEY  - Base64-encoded public key
 * - VAPID_PRIVATE_KEY - Base64-encoded private key
 * - VAPID_EMAIL       - Contact email for VAPID (e.g., mailto:admin@novaincs.com)
 *
 * Generate keys with: npx web-push generate-vapid-keys
 */

import webpush from "web-push";
import { eq, and } from "drizzle-orm";
import { pushSubscriptions } from "@nova/db";
import type { Database } from "@nova/db";

/** Whether push notifications are configured. */
export const isPushConfigured =
  !!process.env.VAPID_PUBLIC_KEY &&
  !!process.env.VAPID_PRIVATE_KEY &&
  !!process.env.VAPID_EMAIL;

// Configure VAPID keys if available
if (isPushConfigured) {
  webpush.setVapidDetails(
    process.env.VAPID_EMAIL!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
}

/** Notification payload structure. */
interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  /** URL to open when the notification is clicked. */
  url?: string;
  /** Additional data for the service worker. */
  data?: Record<string, unknown>;
}

/**
 * Send a push notification to all active subscriptions for a business.
 *
 * Automatically removes expired or invalid subscriptions (410 Gone).
 * Errors on individual subscriptions are logged but don't fail the batch.
 *
 * @param db - Database instance
 * @param businessId - Business UUID to notify
 * @param payload - Notification content
 */
export async function sendPushToBusinessOwners(
  db: Database,
  businessId: string,
  payload: PushPayload,
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!isPushConfigured) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  // Fetch all active subscriptions for this business
  const subscriptions = await db
    .select({
      id: pushSubscriptions.id,
      subscription: pushSubscriptions.subscription,
    })
    .from(pushSubscriptions)
    .where(
      and(
        eq(pushSubscriptions.businessId, businessId),
        eq(pushSubscriptions.isActive, true),
      ),
    );

  if (subscriptions.length === 0) {
    return { sent: 0, failed: 0, removed: 0 };
  }

  const jsonPayload = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const sub of subscriptions) {
    try {
      const pushSub = sub.subscription as webpush.PushSubscription;
      await webpush.sendNotification(pushSub, jsonPayload);
      sent++;
    } catch (err) {
      const statusCode = (err as { statusCode?: number }).statusCode;

      // 410 Gone or 404 = subscription expired, remove it
      if (statusCode === 410 || statusCode === 404) {
        await db
          .delete(pushSubscriptions)
          .where(eq(pushSubscriptions.id, sub.id));
        removed++;
      } else {
        console.error(
          `[push] Failed to send to subscription ${sub.id}:`,
          err instanceof Error ? err.message : err,
        );
        failed++;
      }
    }
  }

  return { sent, failed, removed };
}

/**
 * Send a "new order" push notification to a business.
 *
 * Called when a customer places an order via the storefront.
 * Fire-and-forget: errors are logged but don't block the order flow.
 */
export async function notifyNewOrder(
  db: Database,
  businessId: string,
  orderInfo: {
    customerName: string;
    total: number;
    orderId: string;
  },
): Promise<void> {
  try {
    await sendPushToBusinessOwners(db, businessId, {
      title: "Nuevo pedido",
      body: `${orderInfo.customerName} - $${orderInfo.total.toFixed(2)}`,
      icon: "/favicon.ico",
      tag: `order-${orderInfo.orderId}`,
      url: "/orders",
      data: {
        type: "new_order",
        orderId: orderInfo.orderId,
      },
    });
  } catch (err) {
    // Fire-and-forget: don't let push failures affect order creation
    console.error(
      `[push] Error notifying new order ${orderInfo.orderId}:`,
      err instanceof Error ? err.message : err,
    );
  }
}
