/**
 * UUID validation middleware for route parameters.
 *
 * Returns 400 if the :id param is not a valid UUID v4.
 * Prevents SQL injection and invalid lookups from malformed IDs.
 */

import { createMiddleware } from "hono/factory";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Middleware that validates the :id route parameter is a valid UUID.
 * Uses createMiddleware to preserve Hono's route param type inference.
 */
export const validateUuidParam = createMiddleware(async (c, next) => {
  const id = c.req.param("id");
  if (id && !UUID_RE.test(id)) {
    return c.json({ error: "Invalid ID format" }, 400);
  }
  await next();
});
