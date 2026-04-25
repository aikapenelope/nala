/**
 * Zod schemas for sales operations.
 * Used by both the API (validation) and the frontend (form validation).
 */

import { z } from "zod";
import { paymentMethodSchema } from "./schemas";

/** Valid sale channels. */
export const SALE_CHANNELS = [
  "pos",
  "whatsapp",
  "delivery",
  "online",
] as const;
export type SaleChannel = (typeof SALE_CHANNELS)[number];

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

/** Schema for a surcharge applied to a sale. */
export const saleSurchargeSchema = z.object({
  name: z.string().min(1).max(100),
  amount: z.number().min(0),
});

/** Schema for creating a new sale. */
export const createSaleSchema = z.object({
  customerId: z.string().uuid().optional(),
  items: z.array(saleItemSchema).min(1),
  payments: z.array(salePaymentSchema).min(1),
  discountPercent: z.number().min(0).max(100).default(0),
  /** Fixed discount amount in USD (applied after percentage discount). */
  discountAmount: z.number().min(0).default(0),
  /** Extra charges: delivery, tips, packaging, etc. */
  surcharges: z.array(saleSurchargeSchema).default([]),
  /** Sale channel. */
  channel: z.enum(SALE_CHANNELS).default("pos"),
  notes: z.string().max(500).optional(),
});

/** Schema for voiding a sale (requires owner authorization). */
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
 * Calculate sale total after discounts and surcharges.
 *
 * Flow:
 * 1. Sum line totals (after per-item discounts)
 * 2. Apply sale-level percentage discount
 * 3. Apply sale-level fixed amount discount
 * 4. Add surcharges
 * 5. Return the final total as a number
 */
export function calculateSaleTotal(
  items: Array<{
    quantity: number;
    unitPrice: number;
    discountPercent: number;
  }>,
  saleDiscountPercent: number = 0,
  saleDiscountAmount: number = 0,
  surcharges: Array<{ amount: number }> = [],
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
  const afterAllDiscounts = Math.max(
    0,
    afterPercentDiscount - saleDiscountAmount,
  );

  // 4. Add surcharges
  const surchargeTotal = surcharges.reduce((sum, s) => sum + s.amount, 0);

  return Math.round((afterAllDiscounts + surchargeTotal) * 100) / 100;
}

/**
 * Convert USD to Bs. using the given exchange rate.
 */
export function usdToBs(amountUsd: number, rate: number): number {
  return Math.round(amountUsd * rate * 100) / 100;
}

/**
 * Resolve the effective unit price considering wholesale pricing.
 * Returns wholesalePrice if qty >= wholesaleMinQty, otherwise regular price.
 */
export function resolveUnitPrice(
  quantity: number,
  price: number,
  wholesalePrice: number | null,
  wholesaleMinQty: number,
): number {
  if (wholesalePrice !== null && quantity >= wholesaleMinQty) {
    return wholesalePrice;
  }
  return price;
}
