/**
 * Zod schemas for sales operations.
 * Used by both the API (validation) and the frontend (form validation).
 */

import { z } from "zod";
import { paymentMethodSchema } from "./schemas";

/** Schema for a sale item (line in the ticket). */
export const saleItemSchema = z.object({
  productId: z.string().uuid(),
  variantId: z.string().uuid().optional(),
  quantity: z.number().int().min(1),
  unitPrice: z.number().min(0),
  discountPercent: z.number().min(0).max(100).default(0),
});

/** Schema for a sale payment. */
export const salePaymentSchema = z.object({
  method: paymentMethodSchema,
  amountUsd: z.number().min(0),
  amountBs: z.number().min(0).optional(),
  exchangeRate: z.number().min(0).optional(),
  reference: z.string().max(100).optional(),
});

/** Schema for creating a new sale. */
export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discountPercent: z.number().min(0).max(100).default(0),
  /** Fixed discount amount in USD (applied after percentage discount). */
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
});

/** Schema for voiding a sale (requires owner PIN). */
export const voidSaleSchema = z.object({
  reason: z.string().min(1).max(500),
});

/** Schema for creating a quotation. */
export const createQuotationSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1),
});

/**
 * Calculate line total after discount.
 * lineTotal = quantity * unitPrice * (1 - discountPercent / 100)
 */
export function calculateLineTotal(
  quantity: number,
  unitPrice: number,
  discountPercent: number,
): number {
  return (
    Math.round(quantity * unitPrice * (1 - discountPercent / 100) * 100) / 100
  );
}

/**
 * Calculate sale total after discounts.
 *
 * Flow:
 * 1. Sum line totals (after per-item discounts)
 * 2. Apply sale-level percentage discount
 * 3. Apply sale-level fixed amount discount
 * 4. Return the final total as a number
 */
export function calculateSaleTotal(
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercent: number;
  }>,
  saleDiscountPercent: number = 0,
  saleDiscountAmount: number = 0,
): number {
  // 1. Sum line totals
  const subtotal = items.reduce(
    (sum, item) =>
      sum +
      calculateLineTotal(item.quantity, item.unitPrice, item.discountPercent),
    0,
  );

  // 2-3. Apply sale-level discounts
  const afterPercentDiscount = subtotal * (1 - saleDiscountPercent / 100);
  const total = Math.max(0, afterPercentDiscount - saleDiscountAmount);

  return Math.round(total * 100) / 100;
}

/**
 * Convert USD to Bs. using the given exchange rate.
 */
export function usdToBs(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate * 100) / 100;
}
