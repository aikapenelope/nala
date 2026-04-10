/**
 * Customer and accounts API routes.
 */

import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";
import {
  createCustomerSchema,
  updateCustomerSchema,
  recordPaymentSchema,
  createAccountPayableSchema,
  dayCloseSchema,
} from "@nova/shared";
import type { AppEnv } from "../types";

const customersRoutes = new Hono<AppEnv>();

const listCustomersQuery = z.object({
  search: z.string().optional(),
  segment: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

customersRoutes.get(
  "/customers",
  zValidator("query", listCustomersQuery),
  async (c) => {
    return c.json({ customers: [], total: 0, page: 1, limit: 50 });
  },
);

customersRoutes.get("/customers/:id", async (c) => {
  return c.json({ error: "Not connected to database" }, 503);
});

customersRoutes.post(
  "/customers",
  zValidator("json", createCustomerSchema),
  async (c) => {
    return c.json({ error: "Not connected to database" }, 503);
  },
);

customersRoutes.patch(
  "/customers/:id",
  zValidator("json", updateCustomerSchema),
  async (c) => {
    return c.json({ error: "Not connected to database" }, 503);
  },
);

customersRoutes.get("/accounts/receivable", async (c) => {
  return c.json({ accounts: [], totalPending: 0 });
});

customersRoutes.post(
  "/accounts/receivable/:id/payment",
  zValidator("json", recordPaymentSchema),
  async (c) => {
    return c.json({ error: "Not connected to database" }, 503);
  },
);

customersRoutes.post("/accounts/receivable/collect-all", async (c) => {
  const user = c.get("user");
  return c.json({
    message: "Collection messages generated",
    userId: user.id,
    links: [],
  });
});

customersRoutes.get("/accounts/payable", async (c) => {
  return c.json({ accounts: [], totalPending: 0 });
});

customersRoutes.post(
  "/accounts/payable",
  zValidator("json", createAccountPayableSchema),
  async (c) => {
    return c.json({ error: "Not connected to database" }, 503);
  },
);

customersRoutes.patch(
  "/accounts/payable/:id/pay",
  zValidator("json", recordPaymentSchema),
  async (c) => {
    return c.json({ error: "Not connected to database" }, 503);
  },
);

customersRoutes.post(
  "/day-close",
  zValidator("json", dayCloseSchema),
  async (c) => {
    const user = c.get("user");
    return c.json({
      message: "Day close recorded (placeholder)",
      closedBy: user.name,
    });
  },
);

customersRoutes.get("/day-close/history", async (c) => {
  return c.json({ closes: [] });
});

export { customersRoutes };
