/**
 * Audit logging helper.
 *
 * Provides a fire-and-forget function to log mutations to the activity_log
 * table. If the insert fails, it logs to console but does not throw --
 * audit logging should never break the primary operation.
 *
 * Inspired by ERPNext's immutable document audit trail pattern.
 */

import { activityLog } from "@nova/db";
import type { Database } from "@nova/db";

interface LogActivityParams {
  db: Database;
  businessId: string;
  userId: string;
  action: string;
  detail?: string;
}

/**
 * Log a mutation to the activity_log table.
 * Fire-and-forget: errors are caught and logged to console.
 */
export async function logActivity({
  db,
  businessId,
  userId,
  action,
  detail,
}: LogActivityParams): Promise<void> {
  try {
    await db.insert(activityLog).values({
      businessId,
      userId,
      action,
      detail: detail ?? null,
    });
  } catch (err) {
    // Audit logging should never break the primary operation
    console.error("[audit] Failed to log activity:", action, err);
  }
}
