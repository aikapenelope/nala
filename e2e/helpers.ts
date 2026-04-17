/**
 * E2E test helpers for Nova.
 *
 * Auth bypass strategy:
 * - The API runs in dev mode (no CLERK_SECRET_KEY) with a mock user.
 * - The frontend auth is bypassed by injecting NovaUser + roster into
 *   localStorage before navigating, so the auth middleware sees an
 *   authenticated user and skips Clerk.
 *
 * The mock user matches the API's dev fallback in middleware/auth.ts.
 */

import { type Page } from "@playwright/test";

/** Mock Nova user matching the API dev fallback. */
export const MOCK_USER = {
  id: "dev-user-001",
  name: "Dev User",
  role: "owner" as const,
  businessId: "dev-business-001",
  businessName: "Dev Business",
  clerkId: "dev-clerk-001",
};

/** Mock team roster for local PIN verification. */
const MOCK_ROSTER = {
  roster: [
    {
      id: "dev-user-001",
      name: "Dev User",
      role: "owner",
      // bcrypt hash of "1234" (cost 10)
      pinHash: "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy",
    },
  ],
  businessId: "dev-business-001",
  businessName: "Dev Business",
  generatedAt: new Date().toISOString(),
};

/**
 * Inject authenticated state into localStorage.
 *
 * Call this before navigating to any protected page. Sets the NovaUser
 * and team roster so the auth middleware allows access without Clerk.
 */
export async function loginAsMockUser(page: Page): Promise<void> {
  await page.addInitScript((data) => {
    localStorage.setItem("nova:user", JSON.stringify(data.user));
    localStorage.setItem("nova:businessId", data.user.businessId);
    localStorage.setItem("nova:team-roster", JSON.stringify(data.roster));
  }, { user: MOCK_USER, roster: MOCK_ROSTER });
}

/**
 * Clear all Nova auth state from localStorage.
 */
export async function logout(page: Page): Promise<void> {
  await page.addInitScript(() => {
    localStorage.removeItem("nova:user");
    localStorage.removeItem("nova:businessId");
    localStorage.removeItem("nova:team-roster");
  });
}
