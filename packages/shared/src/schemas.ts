/**
 * Zod schemas for runtime validation shared across the monorepo.
 */

import { z } from "zod";

/** Schema for user roles. */
export const userRoleSchema = z.enum(["owner", "employee"]);

/** Schema for business types. */
export const businessTypeSchema = z.enum([
  "ferreteria",
  "bodega",
  "ropa",
  "autopartes",
  "peluqueria",
  "farmacia",
  "electronica",
  "libreria",
  "cosmeticos",
  "distribuidora",
  "otro",
]);

/** Schema for payment methods. */
export const paymentMethodSchema = z.enum([
  "efectivo",
  "pago_movil",
  "binance",
  "zinli",
  "transferencia",
  "zelle",
  "fiado",
]);

/** Schema for health check response. */
export const healthCheckResponseSchema = z.object({
  status: z.enum(["ok", "degraded", "error"]),
  timestamp: z.string(),
  services: z.object({
    database: z.boolean(),
    redis: z.boolean(),
  }),
});
