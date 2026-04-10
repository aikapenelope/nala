/**
 * Authentication middleware placeholder.
 *
 * Phase 0: Passes through all requests (no auth enforced).
 * Phase 1: Will verify Clerk JWT (owner) or PIN (employee)
 *          and set the user context on the request.
 *
 * The middleware supports two auth methods:
 * - Bearer {jwt}: Clerk JWT for owners on personal devices
 * - Pin {business_id}:{pin}: PIN for employees on shared devices
 */

import type { Context, Next } from "hono";

export interface AuthUser {
  id: string;
  businessId: string;
  name: string;
  role: "owner" | "employee";
}

/**
 * Auth middleware - placeholder for Phase 0.
 * Sets a mock user for development purposes.
 */
export async function authMiddleware(c: Context, next: Next) {
  // Phase 0: Mock user for development
  const mockUser: AuthUser = {
    id: "dev-user-001",
    businessId: "dev-business-001",
    name: "Dev User",
    role: "owner",
  };

  c.set("user", mockUser);
  c.set("businessId", mockUser.businessId);

  await next();
}
