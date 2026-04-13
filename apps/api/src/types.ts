/**
 * Hono application types.
 *
 * Defines the environment (context variables) available
 * in route handlers after middleware runs.
 */

import type { Database } from "@nova/db";
import type { AuthUser } from "./middleware/auth";

/** Hono environment type with custom context variables. */
export interface AppEnv {
  Variables: {
    user: AuthUser;
    businessId: string;
    db: Database;
    requestId: string;
  };
}
