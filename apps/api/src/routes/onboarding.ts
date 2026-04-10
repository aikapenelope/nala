/**
 * Onboarding routes.
 *
 * POST /onboarding - Create a new business + owner user after Clerk registration.
 *
 * This is called once per Clerk user, right after they sign up.
 * It creates the business record, the owner user linked to their Clerk ID,
 * and pre-configures categories and accounting chart based on business type.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import { businessTypeSchema } from "@nova/shared";

const onboarding = new Hono();

/** Schema for onboarding request. */
const onboardingSchema = z.object({
  businessType: businessTypeSchema,
  businessName: z.string().min(1).max(100),
});

/**
 * POST /onboarding - Create business + owner.
 *
 * Requires a valid Clerk session (the user just signed up).
 * Creates:
 * 1. Business record with type and name
 * 2. Owner user linked to the Clerk ID
 * 3. Pre-configured categories for the business type
 * 4. Pre-configured accounting chart (catálogo de cuentas)
 */
onboarding.post("/", zValidator("json", onboardingSchema), async (c) => {
  // TODO: When DB is connected:
  // 1. Get Clerk user ID from auth context
  // 2. Check if user already has a business (prevent duplicates)
  // 3. Create business record
  // 4. Create owner user with clerk_id
  // 5. Pre-configure categories based on businessType
  // 6. Pre-configure accounting chart
  // 7. Return business + user info

  return c.json(
    {
      error: "Onboarding requires database connection",
      hint: "Run docker compose up and configure DATABASE_URL",
    },
    503,
  );
});

export { onboarding };
