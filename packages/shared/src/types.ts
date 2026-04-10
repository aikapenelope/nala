/**
 * Core types shared across the Nova monorepo.
 */

/** User roles in the system. Owner has full access, employee is restricted. */
export type UserRole = "owner" | "employee";

/** Business types supported by Nova for pre-configuration. */
export type BusinessType =
  | "ferreteria"
  | "bodega"
  | "ropa"
  | "autopartes"
  | "peluqueria"
  | "farmacia"
  | "electronica"
  | "libreria"
  | "cosmeticos"
  | "distribuidora"
  | "otro";

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

/** Accounts receivable/payable aging color codes. */
export type AgingColor = "green" | "yellow" | "red";

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
