/**
 * Custom error classes for transaction-level errors.
 *
 * Replaces the fragile pattern of `throw new Error(JSON.stringify({...}))`
 * with typed, catchable error classes that carry structured data.
 *
 * Usage inside transactions:
 *   throw new ValidationError(["Item not found", "Qty exceeds max"]);
 *   throw new StockError("Insufficient stock for Producto X");
 *   throw new UserError("Venta no encontrada", 404);
 *
 * Usage in catch blocks:
 *   if (err instanceof ValidationError) {
 *     return c.json({ error: "Validation", details: err.details }, 400);
 *   }
 */

/**
 * Validation error with multiple detail messages.
 * Used when a transaction discovers multiple validation failures.
 */
export class ValidationError extends Error {
  public readonly details: string[];

  constructor(details: string[]) {
    super(`Validation failed: ${details[0] ?? "unknown"}`);
    this.name = "ValidationError";
    this.details = details;
  }
}

/**
 * Stock insufficiency error.
 * Thrown when a stock guard (WHERE stock >= qty) returns 0 rows.
 */
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

/** HTTP status codes commonly used for user-facing errors. */
type UserErrorStatus = 400 | 401 | 403 | 404 | 409 | 422;

/**
 * User-facing error with HTTP status code.
 * Used for business logic errors that should be returned directly to the client.
 */
export class UserError extends Error {
  public readonly status: UserErrorStatus;

  constructor(message: string, status: UserErrorStatus = 400) {
    super(message);
    this.name = "UserError";
    this.status = status;
  }
}

/**
 * Price mismatch error for storefront orders.
 * Thrown when client-sent prices don't match DB prices.
 */
export class PriceError extends Error {
  public readonly details: string[];

  constructor(details: string[]) {
    super(`Price mismatch: ${details[0] ?? "unknown"}`);
    this.name = "PriceError";
    this.details = details;
  }
}

/**
 * Minimum order amount not met.
 */
export class MinOrderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MinOrderError";
  }
}
