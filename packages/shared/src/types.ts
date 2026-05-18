/**
 * Core types shared across the Nova monorepo.
 */

/** User role. Single-user model: always "owner". */
export type UserRole = "owner";

/**
 * Business types for onboarding and storefront configuration.
 *
 * Simplified to 4 core types that cover the target market:
 * - tienda: bodega, mini-market, tienda de barrio
 * - moda: ropa, cosmeticos, accesorios, calzado
 * - servicios: peluqueria, barberia, profesionales, talleres
 * - otro: everything else (electronica, distribuidora, etc.)
 *
 * Legacy types (ferreteria, farmacia, libreria, etc.) are still
 * accepted at runtime for backward compatibility with existing
 * businesses, but are no longer shown in onboarding.
 */
export type BusinessType =
  | "tienda"
  | "moda"
  | "servicios"
  | "otro"
  // Legacy types (backward compat, not shown in onboarding)
  | "ferreteria"
  | "bodega"
  | "ropa"
  | "autopartes"
  | "peluqueria"
  | "farmacia"
  | "electronica"
  | "libreria"
  | "cosmeticos"
  | "distribuidora";

/** Payment methods available in Venezuela. */
export type PaymentMethod =
  | "efectivo"
  | "pago_movil"
  | "binance"
  | "zinli"
  | "transferencia"
  | "zelle"
  | "fiado";

/** Stock status semaphore colors. */
export type StockStatus = "green" | "yellow" | "red" | "gray";

/** API response wrapper for consistent responses. */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

/** Health check response from the API. */
export interface HealthCheckResponse {
  status: "ok" | "degraded" | "error";
  timestamp: string;
  services: {
    database: boolean;
    redis: boolean;
  };
}
